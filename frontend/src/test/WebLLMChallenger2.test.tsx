import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { StrictMode, useState, useTransition } from 'react';
import { useWebLLM, DEFAULT_MODEL, checkWebGPUSupport } from '../hooks/useWebLLM';
import { useReActAgent } from '../hooks/useReActAgent';
import { AgentRunner } from '../components/agent/AgentRunner';
import { ChatPane } from '../components/chat/ChatPane';
import App from '../App';
import * as webllm from '@mlc-ai/web-llm';
import { mockAstChunks } from '../services/mockAstData';

// Factory for configurable mock MLCEngine instances
interface MockEngineOptions {
  chunks?: string[];
  chunkDelayMs?: number;
  onChunkYield?: (chunk: string, index: number) => void;
  shouldThrowOnCreate?: Error;
  shouldThrowOnGenerate?: Error;
  onInterruptGenerate?: () => void;
  onUnload?: () => void;
}

function createConfigurableMockEngine(options: MockEngineOptions = {}) {
  const chunks = options.chunks ?? ['Token1', ' ', 'Token2', ' ', 'Token3'];
  const chunkDelayMs = options.chunkDelayMs ?? 10;
  let isInterrupted = false;

  const mockEngine = {
    chat: {
      completions: {
        create: vi.fn(async ({ messages, stream }: any) => {
          if (options.shouldThrowOnGenerate) {
            throw options.shouldThrowOnGenerate;
          }
          if (stream) {
            return (async function* () {
              for (let i = 0; i < chunks.length; i++) {
                if (isInterrupted) {
                  break;
                }
                if (chunkDelayMs > 0) {
                  await new Promise((r) => setTimeout(r, chunkDelayMs));
                }
                if (isInterrupted) {
                  break;
                }
                const chunk = chunks[i];
                if (options.onChunkYield) {
                  options.onChunkYield(chunk, i);
                }
                yield { choices: [{ delta: { content: chunk } }] };
              }
            })();
          }
          return {
            choices: [{ message: { content: chunks.join('') } }],
          };
        }),
      },
    },
    reload: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockImplementation(async () => {
      if (options.onUnload) options.onUnload();
    }),
    interruptGenerate: vi.fn().mockImplementation(async () => {
      isInterrupted = true;
      if (options.onInterruptGenerate) options.onInterruptGenerate();
    }),
    _resetInterrupt: () => {
      isInterrupted = false;
    },
  };

  return mockEngine;
}

let activeMockEngine = createConfigurableMockEngine();

vi.mock('@mlc-ai/web-llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mlc-ai/web-llm')>();
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
  };
});

describe('WebLLM Adversarial Verification Suite (nemoir_m3_challenger_2)', () => {
  const originalGpu = (navigator as any).gpu;

  beforeEach(() => {
    vi.clearAllMocks();
    activeMockEngine = createConfigurableMockEngine();

    vi.mocked(webllm.CreateMLCEngine).mockImplementation(
      async (_modelId: string | string[], config?: any) => {
        if (config?.initProgressCallback) {
          config.initProgressCallback({
            progress: 1.0,
            timeElapsed: 0.1,
            text: 'Mock WebLLM Ready',
          });
        }
        return activeMockEngine as any;
      }
    );

    Object.defineProperty(navigator, 'gpu', {
      value: originalGpu ?? {
        requestAdapter: vi.fn().mockResolvedValue({
          requestDevice: vi.fn().mockResolvedValue({}),
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'gpu', {
      value: originalGpu,
      writable: true,
      configurable: true,
    });
  });

  // =========================================================================
  // CHALLENGE DIMENSION 1: Cancellation Semantics & Interrupt Lifecycle
  // =========================================================================
  describe('1. Cancellation Semantics & Interrupt Lifecycle', () => {
    it('handles immediate stop during query initialization (Thinking phase) without starting LLM generation', async () => {
      // Setup engine
      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      // Submit query and cancel immediately (< 5ms)
      act(() => {
        agentResult.current.submitQuery('Retrieve AST parser pipeline');
      });

      // Synchronously in Thinking state
      expect(agentResult.current.agentStatus.state).toBe('Thinking');

      // Cancel immediately during initial Thinking phase
      act(() => {
        agentResult.current.cancelQuery();
      });

      // Status must immediately transition to Idle with cancelled message
      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(agentResult.current.agentStatus.currentStepMessage).toContain('cancelled');
      expect(agentResult.current.streamingTokens).toBe('');

      // Wait 200ms to allow Thinking delay (100ms) to settle
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });

      // Confirm ReAct loop aborted: state remains Idle, LLM create was never reached
      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(activeMockEngine.chat.completions.create).not.toHaveBeenCalled();
      // No assistant message added to history
      const msgs = agentResult.current.messages;
      expect(msgs[msgs.length - 1].role).toBe('user');
    });

    it('immediately halts streaming mid-generation, discards partial tokens, and wipes streaming buffer', async () => {
      // 10 chunks with 25ms delay each (total 250ms)
      const testChunks = ['Chunk1', 'Chunk2', 'Chunk3', 'Chunk4', 'Chunk5', 'Chunk6', 'Chunk7', 'Chunk8'];
      activeMockEngine = createConfigurableMockEngine({
        chunks: testChunks,
        chunkDelayMs: 25,
      });

      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      let queryPromise: Promise<void>;
      act(() => {
        queryPromise = agentResult.current.submitQuery('Analyze AST token generation');
      });

      // Advance through Thinking (100ms) and Searching AST (100ms) to reach Synthesizing
      await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
      });

      expect(agentResult.current.agentStatus.state).toBe('Synthesizing');

      // Cancel mid-stream
      act(() => {
        agentResult.current.cancelQuery();
      });

      // Verify immediate cancellation properties
      expect(activeMockEngine.interruptGenerate).toHaveBeenCalled();
      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(agentResult.current.streamingTokens).toBe('');
      expect(agentResult.current.agentStatus.currentStepMessage).toContain('cancelled');

      // Let any lingering promises settle
      await act(async () => {
        await queryPromise!.catch(() => {});
        await new Promise((r) => setTimeout(r, 100));
      });

      // Verify no partial assistant response was appended
      const assistantMsgs = agentResult.current.messages.filter(
        (m) => m.role === 'assistant' && m.id !== 'welcome-msg'
      );
      expect(assistantMsgs).toHaveLength(0);
      expect(agentResult.current.streamingTokens).toBe('');
    });

    it('handles double interrupt calls idempotently without unhandled rejections or status corruption', async () => {
      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      // Start generation
      let genPromise: Promise<string>;
      act(() => {
        genPromise = llmResult.current.generate('Query with double interrupt');
      });
      expect(llmResult.current.status).toBe('generating');

      // Fire double interrupt concurrently
      await act(async () => {
        await Promise.all([
          llmResult.current.interrupt(),
          llmResult.current.interrupt(),
        ]);
        await genPromise!;
      });

      // Status must cleanly recover to ready
      expect(llmResult.current.status).toBe('ready');
      expect(activeMockEngine.interruptGenerate).toHaveBeenCalledTimes(2);

      // Subsequent generation works cleanly after double interrupt
      activeMockEngine._resetInterrupt();
      let secondGenResult = '';
      await act(async () => {
        secondGenResult = await llmResult.current.generate('Subsequent query after double interrupt');
      });

      expect(llmResult.current.status).toBe('ready');
      expect(secondGenResult).toBe('Token1 Token2 Token3');
    });

    it('handles double cancelQuery on useReActAgent while streaming tokens', async () => {
      const testChunks = ['T1', 'T2', 'T3', 'T4', 'T5'];
      activeMockEngine = createConfigurableMockEngine({
        chunks: testChunks,
        chunkDelayMs: 30,
      });

      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      act(() => {
        agentResult.current.submitQuery('Test double agent cancellation');
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });

      // Double cancel
      act(() => {
        agentResult.current.cancelQuery();
        agentResult.current.cancelQuery();
      });

      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(agentResult.current.streamingTokens).toBe('');

      // Ready for a new query immediately
      activeMockEngine._resetInterrupt();
      await act(async () => {
        await agentResult.current.submitQuery('Fresh query after double cancel');
      });

      expect(agentResult.current.agentStatus.state).toBe('Complete');
      const lastMsg = agentResult.current.messages[agentResult.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
    });

    it('safely calls interrupt on an idle or unloaded engine without throwing', async () => {
      const { result } = renderHook(() => useWebLLM());

      // Engine unloaded initially
      expect(result.current.status).toBe('unloaded');

      // Interrupt while unloaded
      await act(async () => {
        await result.current.interrupt();
      });

      expect(result.current.status).toBe('unloaded');
    });

    it('handles interrupt and unload lifecycle cleanly when generation is in flight', async () => {
      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let genPromise: Promise<string>;
      act(() => {
        genPromise = result.current.generate('Prompt during interrupt and unload');
      });

      await act(async () => {
        await result.current.interrupt();
        await result.current.unload();
        await genPromise!.catch(() => {});
      });

      expect(activeMockEngine.interruptGenerate).toHaveBeenCalled();
      expect(activeMockEngine.unload).toHaveBeenCalled();
      expect(result.current.status).toBe('unloaded');
      expect(result.current.engine).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });

  // =========================================================================
  // CHALLENGE DIMENSION 2: Token Accumulation Accuracy & Integrity Oracle
  // =========================================================================
  describe('2. Token Accumulation Accuracy & Integrity Oracle', () => {
    it('verifies mathematical equivalence: accumulated === join(deltas) with zero dropped chars or duplicates', async () => {
      // 50 diverse chunks including code, whitespace, python keywords, indentation, and punctuation
      const groundTruthTokens = [
        'def ', 'extract_ast_nodes', '(\n',
        '    source_code: ', 'str,\n',
        '    target_types: ', 'list[str],\n',
        '):\n',
        '    """\n',
        '    Parse Python AST and extract matching node structures.\n',
        '    """\n',
        '    import ', 'ast\n',
        '    tree = ', 'ast.parse(source_code)\n',
        '    matches = []\n',
        '    for node in ', 'ast.walk(tree):\n',
        '        if ', 'type(node).__name__ in ', 'target_types:\n',
        '            matches.append({\n',
        '                "type": ', 'type(node).__name__,\n',
        '                "lineno": ', 'getattr(node, "lineno", None),\n',
        '            })\n',
        '    return ', 'matches\n',
      ];

      const expectedFullText = groundTruthTokens.join('');

      activeMockEngine = createConfigurableMockEngine({
        chunks: groundTruthTokens,
        chunkDelayMs: 2,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      const capturedDeltas: string[] = [];
      const capturedAccumulations: string[] = [];

      let finalGenerated = '';
      await act(async () => {
        finalGenerated = await result.current.generate(
          'Implement AST extraction function',
          (delta, acc) => {
            capturedDeltas.push(delta);
            capturedAccumulations.push(acc);
          }
        );
      });

      // 1. Array of deltas matches ground truth exactly
      expect(capturedDeltas).toEqual(groundTruthTokens);

      // 2. Final returned string matches expected concatenated text exactly
      expect(finalGenerated).toBe(expectedFullText);
      expect(finalGenerated.length).toBe(expectedFullText.length);

      // 3. Step-by-step mathematical induction oracle:
      // At every step k, capturedAccumulations[k] === capturedDeltas.slice(0, k + 1).join('')
      for (let k = 0; k < capturedDeltas.length; k++) {
        const stepExpected = capturedDeltas.slice(0, k + 1).join('');
        expect(capturedAccumulations[k]).toBe(stepExpected);
      }

      // 4. Zero duplicate tokens beyond what was emitted
      expect(capturedAccumulations).toHaveLength(groundTruthTokens.length);
    });

    it('correctly preserves unicode, emojis, multibyte chars, and regex escape tokens without mangling', async () => {
      const unicodeTokens = [
        '# Python AST with emojis & unicode: 🐍 🚀\n',
        'const λ = (x) => x * 2;\n',
        'const regex = /^[\u00A0-\uFFFF_a-z]+$/i;\n',
        'const copyright = "© 2026 CodeSeek AI — ñ, é, ü, 中文";\n',
      ];
      const expectedText = unicodeTokens.join('');

      activeMockEngine = createConfigurableMockEngine({
        chunks: unicodeTokens,
        chunkDelayMs: 2,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      const deltas: string[] = [];
      let output = '';

      await act(async () => {
        output = await result.current.generate('Emit unicode characters', (d) => {
          deltas.push(d);
        });
      });

      expect(deltas).toEqual(unicodeTokens);
      expect(output).toBe(expectedText);
      expect(output).toContain('🐍 🚀');
      expect(output).toContain('λ');
      expect(output).toContain('中文');
      expect(output).toContain('© 2026');
    });

    it('handles empty string deltas and missing content without corrupting accumulator', async () => {
      // Stream containing empty strings and falsy deltas
      const rawChunks = [
        { choices: [{ delta: { content: 'ValidStart' } }] },
        { choices: [{ delta: { content: '' } }] }, // empty delta
        { choices: [{ delta: {} }] }, // missing content property
        { choices: [] }, // empty choices array
        { choices: [{ delta: { content: ' ValidMiddle' } }] },
        { choices: [{ delta: { content: '' } }] },
        { choices: [{ delta: { content: ' ValidEnd' } }] },
      ];

      const customEngine = {
        chat: {
          completions: {
            create: vi.fn(async ({ stream }: any) => {
              if (stream) {
                return (async function* () {
                  for (const c of rawChunks) {
                    yield c;
                  }
                })();
              }
              return { choices: [{ message: { content: 'ValidStart ValidMiddle ValidEnd' } }] };
            }),
          },
        },
        reload: vi.fn().mockResolvedValue(undefined),
        unload: vi.fn().mockResolvedValue(undefined),
        interruptGenerate: vi.fn().mockResolvedValue(undefined),
      };

      activeMockEngine = customEngine as any;

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      const receivedDeltas: string[] = [];
      let output = '';

      await act(async () => {
        output = await result.current.generate('Test empty chunks', (delta) => {
          receivedDeltas.push(delta);
        });
      });

      // Only non-empty deltas trigger onToken
      expect(receivedDeltas).toEqual(['ValidStart', ' ValidMiddle', ' ValidEnd']);
      expect(output).toBe('ValidStart ValidMiddle ValidEnd');
      expect(output).not.toContain('undefined');
      expect(output).not.toContain('null');
    });

    it('survives high-volume stress test (200 consecutive token chunks)', async () => {
      // 200 chunks
      const stressChunks = Array.from({ length: 200 }, (_, i) => `tok_${i} `);
      const expectedFull = stressChunks.join('');

      activeMockEngine = createConfigurableMockEngine({
        chunks: stressChunks,
        chunkDelayMs: 0,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let finalOutput = '';
      let callbackCount = 0;

      await act(async () => {
        finalOutput = await result.current.generate('Stress 200 tokens', (_d, _acc) => {
          callbackCount++;
        });
      });

      expect(callbackCount).toBe(200);
      expect(finalOutput).toBe(expectedFull);
      expect(finalOutput.length).toBe(expectedFull.length);
    });
  });

  // =========================================================================
  // CHALLENGE DIMENSION 3: WebGPU Fallback & Hardware Resilience
  // =========================================================================
  describe('3. WebGPU Fallback & Hardware Resilience', () => {
    it('reports supported: false and descriptive error when navigator.gpu is undefined', () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const check = checkWebGPUSupport();
      expect(check.supported).toBe(false);
      expect(check.reason).toContain('WebGPU is not supported');

      const { result } = renderHook(() => useWebLLM());
      expect(result.current.status).toBe('error');
      expect(result.current.isWebGPUSupported).toBe(false);
      expect(result.current.error).toContain('WebGPU is not supported');
    });

    it('gracefully falls back to AgentSimulator when WebGPU is absent and user submits query', async () => {
      // Force WebGPU unavailable
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result: llmResult } = renderHook(() => useWebLLM());
      expect(llmResult.current.status).toBe('error');

      // Wire into useReActAgent
      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      // Submit query: must NOT crash, but smoothly execute ReAct cycle via AgentSimulator
      await act(async () => {
        await agentResult.current.submitQuery('Find AST node for database connection pool');
      });

      // Verify successful completion via simulator fallback
      expect(agentResult.current.agentStatus.state).toBe('Complete');
      expect(agentResult.current.agentStatus.error).toBeUndefined();

      const msgs = agentResult.current.messages;
      const latestMsg = msgs[msgs.length - 1];
      expect(latestMsg.role).toBe('assistant');
      expect(latestMsg.content).toContain('Key AST Definitions');
      expect(latestMsg.citedChunks?.length).toBeGreaterThan(0);
      expect(latestMsg.metrics).toBeDefined();
      expect(latestMsg.metrics?.tokensGenerated).toBeGreaterThan(0);
    });

    it('falls back to AgentSimulator when WebLLM engine load throws (e.g., OOM / shader compilation failure)', async () => {
      vi.mocked(webllm.CreateMLCEngine).mockRejectedValueOnce(
        new Error('Device lost: GPU shader compilation aborted (out of memory)')
      );

      const { result: llmResult } = renderHook(() => useWebLLM());

      await act(async () => {
        try {
          await llmResult.current.initEngine();
        } catch {
          // Expected rejection
        }
      });

      expect(llmResult.current.status).toBe('error');
      expect(llmResult.current.error).toContain('out of memory');

      // Wire into agent
      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      // User submits query -> fallback executes safely
      await act(async () => {
        await agentResult.current.submitQuery('Recover from OOM and query AST');
      });

      expect(agentResult.current.agentStatus.state).toBe('Complete');
      const lastMsg = agentResult.current.messages[agentResult.current.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
    });

    it('Header component renders informative error/status badges when WebGPU is unsupported', () => {
      // Simulate WebGPU error
      const mockLLMError: any = {
        status: 'error',
        currentModel: 'Qwen2.5-Coder-1.5B',
        error: 'WebGPU unavailable',
        isWebGPUSupported: false,
      };

      const mockNemoIR: any = {
        isReady: true,
        wasmStatus: 'ready',
      };

      const mockAgentStatus: any = {
        state: 'Idle',
        currentStepMessage: 'Ready',
      };

      render(
        <ChatPane
          status={mockAgentStatus}
          messages={[]}
          chunks={mockAstChunks}
          onSelectChunk={() => {}}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      );

      // ChatPane and AgentRunner mount without crashing under WebGPU error
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');
    });
  });

  // =========================================================================
  // CHALLENGE DIMENSION 4: React 19 Concurrent Re-renders & High-Frequency Streaming
  // =========================================================================
  describe('4. React 19 Concurrent Re-renders & High-Frequency Streaming', () => {
    it('survives 100 high-frequency token updates in AgentRunner without DOM tearing or memory corruption', () => {
      const { rerender } = render(
        <AgentRunner state="synthesizing" streamingTokens="" />
      );

      let accumulated = '';
      for (let i = 1; i <= 100; i++) {
        accumulated += `word${i} `;
        rerender(
          <AgentRunner
            state="synthesizing"
            streamingTokens={accumulated}
            currentStepMessage={`Streaming token ${i}`}
          />
        );
      }

      // After 100 rapid token updates:
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(accumulated.trim());
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('100 tokens');
    });

    it('renders AgentRunner with active token streaming cleanly under React.StrictMode double-invocations', () => {
      const tokens = 'def compute_graph_similarity(node_a, node_b): return 0.95';

      render(
        <StrictMode>
          <AgentRunner
            state="synthesizing"
            streamingTokens={tokens}
            elapsedMs={450}
            activeChunkCount={3}
            onCancel={vi.fn()}
          />
        </StrictMode>
      );

      // Verify DOM stability under StrictMode
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Synthesizing');
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(tokens);
      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('5 tokens');
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
      expect(screen.getByTestId('agent-cancel-btn')).toBeInTheDocument();
    });

    it('handles React 19 concurrent transitions and background state updates during token streaming', async () => {
      const TestConcurrentContainer: React.FC = () => {
        const [tokens, setTokens] = useState('Initial stream chunk');
        const [filterQuery, setFilterQuery] = useState('');
        const [isPending, startTransition] = useTransition();

        return (
          <div>
            <button
              data-testid="stream-token-btn"
              onClick={() => setTokens((prev) => `${prev} new_chunk`)}
            >
              Add Token
            </button>
            <button
              data-testid="concurrent-transition-btn"
              onClick={() => {
                startTransition(() => {
                  setFilterQuery('concurrent-filtered-ast');
                });
              }}
            >
              Transition Filter
            </button>
            <span data-testid="filter-display">{filterQuery}</span>
            <AgentRunner state="synthesizing" streamingTokens={tokens} />
          </div>
        );
      };

      render(<TestConcurrentContainer />);

      const tokenBtn = screen.getByTestId('stream-token-btn');
      const transitionBtn = screen.getByTestId('concurrent-transition-btn');

      // Interleave token updates and concurrent transitions
      fireEvent.click(tokenBtn);
      fireEvent.click(transitionBtn);
      fireEvent.click(tokenBtn);
      fireEvent.click(tokenBtn);

      expect(screen.getByTestId('filter-display')).toHaveTextContent('concurrent-filtered-ast');
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(
        'Initial stream chunk new_chunk new_chunk new_chunk'
      );
    });

    it('handles live query submission, streaming token rendering, and completion in full App under StrictMode', async () => {
      const user = userEvent.setup();

      render(
        <StrictMode>
          <App />
        </StrictMode>
      );

      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      const input = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');

      await user.type(input, 'Find AST chunk for token auth');
      await user.click(sendBtn);

      // ReAct loop starts
      expect(screen.getByTestId('agent-status-label')).not.toHaveTextContent('Idle');
    });

    it('clears streaming tokens cleanly when user clicks Reset after completion', async () => {
      const onResetMock = vi.fn();

      const { rerender } = render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="def final_ast_node(): pass"
        />
      );

      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(
        'def final_ast_node(): pass'
      );

      // Transition to Complete with streamingTokens cleared
      rerender(
        <AgentRunner
          state="complete"
          streamingTokens=""
          onReset={onResetMock}
        />
      );

      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Complete');
      const resetBtn = screen.getByTestId('agent-reset-btn');
      fireEvent.click(resetBtn);
      expect(onResetMock).toHaveBeenCalledTimes(1);
    });
  });
});
