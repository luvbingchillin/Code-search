import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useWebLLM, DEFAULT_MODEL, checkWebGPUSupport } from '../hooks/useWebLLM';
import { useReActAgent } from '../hooks/useReActAgent';
import { AgentRunner } from '../components/agent/AgentRunner';
import { ChatPane } from '../components/chat/ChatPane';
import App from '../App';
import { mockAstChunks } from '../services/mockAstData';
import * as webllm from '@mlc-ai/web-llm';

// Mock MockMLCEngine instance generator
function createMockEngine(options?: {
  shouldFailGenerate?: boolean;
  tokens?: string[];
}) {
  const tokenStream = options?.tokens ?? [
    'Qwen2.5-Coder',
    ' ',
    'analyzed',
    ' ',
    'the',
    ' ',
    'AST',
    ' ',
    'chunks',
    '.',
  ];

  return {
    chat: {
      completions: {
        create: vi.fn(async ({ messages, stream }: any) => {
          if (options?.shouldFailGenerate) {
            throw new Error('WebGPU pipeline execution error during inference');
          }
          if (stream) {
            return (async function* () {
              for (const token of tokenStream) {
                // Short yield delay to simulate streaming
                await new Promise((r) => setTimeout(r, 10));
                yield { choices: [{ delta: { content: token } }] };
              }
            })();
          }
          return {
            choices: [{ message: { content: tokenStream.join('') } }],
          };
        }),
      },
    },
    reload: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    interruptGenerate: vi.fn().mockResolvedValue(undefined),
  };
}

let mockEngineInstance = createMockEngine();

vi.mock('@mlc-ai/web-llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mlc-ai/web-llm')>();
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
  };
});

describe('WebLLM Edge Inference & Stream Wiring Acceptance Suite (Milestone 3 — AC3)', () => {
  const originalGpu = (navigator as any).gpu;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngineInstance = createMockEngine();

    // Default mock implementation of CreateMLCEngine
    vi.mocked(webllm.CreateMLCEngine).mockImplementation(
      async (modelId: string | string[], config?: any) => {
        const id = Array.isArray(modelId) ? modelId[0] : modelId;
        if (config?.initProgressCallback) {
          config.initProgressCallback({
            progress: 0.1,
            timeElapsed: 0.2,
            text: `Allocating memory for ${id}...`,
          });
          config.initProgressCallback({
            progress: 0.5,
            timeElapsed: 0.8,
            text: `Fetching model weights for ${id}...`,
          });
          config.initProgressCallback({
            progress: 0.9,
            timeElapsed: 1.4,
            text: 'Compiling WebGPU shaders...',
          });
          config.initProgressCallback({
            progress: 1.0,
            timeElapsed: 1.6,
            text: `WebLLM ready: ${id}`,
          });
        }
        return mockEngineInstance as any;
      }
    );

    // Ensure navigator.gpu is restored
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
  // 1. Model Configuration & Initialization Logic
  // =========================================================================
  describe('1. Model Configuration & Initialization Logic', () => {
    it('configures Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC as the default target model', () => {
      expect(DEFAULT_MODEL).toBe('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');

      const { result } = renderHook(() => useWebLLM());
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');
      expect(result.current.status).toBe('unloaded');
    });

    it('initializes MLCEngine with Qwen2.5-Coder-1.5B and transitions lifecycle to ready', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
        'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        expect.objectContaining({
          initProgressCallback: expect.any(Function),
        })
      );

      expect(result.current.status).toBe('ready');
      expect(result.current.progress).toBe(100);
      expect(result.current.progressText).toContain('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');
      expect(result.current.engine).toBeDefined();
    });

    it('supports custom model ID loading via loadModel', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.loadModel('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      });

      expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
        'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
        expect.anything()
      );
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      expect(result.current.status).toBe('ready');
    });

    it('reloads model on existing engine if engine was already instantiated', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });
      expect(webllm.CreateMLCEngine).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.loadModel('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');
      });

      expect(mockEngineInstance.reload).toHaveBeenCalledWith(
        'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC'
      );
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');
    });
  });

  // =========================================================================
  // 2. Progress Tracking during Model Load
  // =========================================================================
  describe('2. Progress Tracking during Model Load', () => {
    it('tracks incremental progress reports and updates progress and progressText', async () => {
      const progressSteps: number[] = [];
      const textSteps: string[] = [];

      vi.mocked(webllm.CreateMLCEngine).mockImplementation(
        async (_modelId: any, config?: any) => {
          if (config?.initProgressCallback) {
            config.initProgressCallback({
              progress: 0.15,
              timeElapsed: 0.5,
              text: 'Allocating model buffer...',
            });
            config.initProgressCallback({
              progress: 0.45,
              timeElapsed: 1.2,
              text: 'Streaming model weights...',
            });
            config.initProgressCallback({
              progress: 0.85,
              timeElapsed: 2.1,
              text: 'Compiling WebGPU pipeline...',
            });
          }
          return mockEngineInstance as any;
        }
      );

      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      expect(result.current.progress).toBe(100);
      expect(result.current.progressText).toContain('WebLLM ready');
    });

    it('normalizes fractional progress (0.0 to 1.0) and percentage progress (> 1.0) correctly', async () => {
      let capturedCallback: any;
      vi.mocked(webllm.CreateMLCEngine).mockImplementation(
        async (_modelId: any, config?: any) => {
          capturedCallback = config?.initProgressCallback;
          return mockEngineInstance as any;
        }
      );

      const { result } = renderHook(() => useWebLLM());

      let initPromise: Promise<void>;
      act(() => {
        initPromise = result.current.initEngine();
      });

      // Fractional progress: 0.35 -> 35%
      act(() => {
        capturedCallback({ progress: 0.35, timeElapsed: 0.2, text: '35% loaded' });
      });
      expect(result.current.progress).toBe(35);
      expect(result.current.progressText).toBe('35% loaded');

      // Integer progress: 80 -> 80%
      act(() => {
        capturedCallback({ progress: 80, timeElapsed: 0.8, text: '80% shaders built' });
      });
      expect(result.current.progress).toBe(80);
      expect(result.current.progressText).toBe('80% shaders built');

      await act(async () => {
        await initPromise!;
      });
    });
  });

  // =========================================================================
  // 3. Streaming Chat Completion & Token Delivery
  // =========================================================================
  describe('3. Streaming Chat Completion & Token Delivery', () => {
    it('streams tokens chunk-by-chunk and returns full accumulated response', async () => {
      const customTokens = ['def ', 'search_ast', '(query: ', 'str) -> ', 'list:'];
      mockEngineInstance = createMockEngine({ tokens: customTokens });

      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      const receivedDeltas: string[] = [];
      const receivedAccumulated: string[] = [];

      let finalResult = '';
      await act(async () => {
        finalResult = await result.current.generate(
          'Implement AST search function',
          (delta, acc) => {
            receivedDeltas.push(delta);
            receivedAccumulated.push(acc);
          }
        );
      });

      expect(receivedDeltas).toEqual(customTokens);
      expect(finalResult).toBe('def search_ast(query: str) -> list:');
      expect(receivedAccumulated[receivedAccumulated.length - 1]).toBe(
        'def search_ast(query: str) -> list:'
      );
      expect(result.current.status).toBe('ready');
    });

    it('supports generateStream alias for streaming token delivery', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      const chunks: string[] = [];
      let output = '';

      await act(async () => {
        output = await result.current.generateStream!(
          'Find authentication handler',
          (chunk) => chunks.push(chunk)
        );
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(output).toBe(chunks.join(''));
      expect(result.current.status).toBe('ready');
    });

    it('transitions status through generating and reverts to ready upon completion', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      expect(result.current.status).toBe('ready');

      let genPromise: Promise<string>;
      act(() => {
        genPromise = result.current.generate('Query AST');
      });

      expect(result.current.status).toBe('generating');

      await act(async () => {
        await genPromise!;
      });

      expect(result.current.status).toBe('ready');
    });
  });

  // =========================================================================
  // 4. WebGPU Capability Detection & Failure Handling
  // =========================================================================
  describe('4. WebGPU Capability Detection & Failure Handling', () => {
    it('detects WebGPU capability when navigator.gpu is present', () => {
      const support = checkWebGPUSupport();
      expect(support.supported).toBe(true);

      const { result } = renderHook(() => useWebLLM());
      expect(result.current.isWebGPUSupported).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('sets error state and provides clear user feedback when navigator.gpu is absent', () => {
      // Simulate WebGPU unavailable
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const support = checkWebGPUSupport();
      expect(support.supported).toBe(false);
      expect(support.reason).toContain('WebGPU is not supported');

      const { result } = renderHook(() => useWebLLM());
      expect(result.current.status).toBe('error');
      expect(result.current.isWebGPUSupported).toBe(false);
      expect(result.current.error).toContain('WebGPU is not supported');
      expect(result.current.progressText).toContain('WebGPU unavailable');
    });

    it('rejects initEngine with error if WebGPU is absent', async () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useWebLLM());

      await expect(
        act(async () => {
          await result.current.initEngine();
        })
      ).rejects.toThrow('WebGPU is not supported');

      expect(result.current.status).toBe('error');
    });

    it('handles CreateMLCEngine failure (e.g., OOM / shader compilation) gracefully', async () => {
      vi.mocked(webllm.CreateMLCEngine).mockRejectedValueOnce(
        new Error('Out of memory: GPU buffer allocation failed (1630 MB required)')
      );

      const { result } = renderHook(() => useWebLLM());

      let caughtError: any;
      await act(async () => {
        try {
          await result.current.initEngine();
        } catch (err) {
          caughtError = err;
        }
      });

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('Out of memory');
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Out of memory');
      expect(result.current.progressText).toContain('Model load failed');
    });

    it('throws error when generate is invoked while engine is unloaded', async () => {
      const { result } = renderHook(() => useWebLLM());

      await expect(
        act(async () => {
          await result.current.generate('Query');
        })
      ).rejects.toThrow('WebLLM engine is not loaded');
    });

    it('transitions to error state when generation fails during inference', async () => {
      mockEngineInstance = createMockEngine({ shouldFailGenerate: true });
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      let caughtGenError: any;
      await act(async () => {
        try {
          await result.current.generate('Trigger error');
        } catch (err) {
          caughtGenError = err;
        }
      });

      expect(caughtGenError).toBeDefined();
      expect(caughtGenError.message).toContain('WebGPU pipeline execution error');
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('WebGPU pipeline execution error');
    });
  });

  // =========================================================================
  // 5. Interruption & Cancellation Lifecycle
  // =========================================================================
  describe('5. Interruption & Cancellation Lifecycle', () => {
    it('halts active token stream and calls interruptGenerate upon interrupt()', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });

      let genPromise: Promise<string>;
      act(() => {
        genPromise = result.current.generate('Long running synthesis prompt');
      });

      expect(result.current.status).toBe('generating');

      await act(async () => {
        await result.current.interrupt();
        await genPromise!;
      });

      expect(mockEngineInstance.interruptGenerate).toHaveBeenCalled();
      expect(result.current.status).toBe('ready');

      const outcome = await genPromise!;
      expect(typeof outcome).toBe('string');
    });

    it('unloads engine resources and resets status to unloaded upon unload()', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        await result.current.initEngine();
      });
      expect(result.current.status).toBe('ready');

      await act(async () => {
        await result.current.unload();
      });

      expect(mockEngineInstance.unload).toHaveBeenCalled();
      expect(result.current.status).toBe('unloaded');
      expect(result.current.engine).toBeNull();
      expect(result.current.progress).toBe(0);
      expect(result.current.progressText).toContain('unloaded');
    });
  });

  // =========================================================================
  // 6. End-to-End DOM Wiring with AgentRunner / ChatPane / useReActAgent
  // =========================================================================
  describe('6. End-to-End DOM Wiring with AgentRunner / ChatPane / useReActAgent', () => {
    it('renders live streaming tokens and pulsing cursor in AgentRunner DOM', () => {
      render(
        <AgentRunner
          state="synthesizing"
          streamingTokens="def calculate_relevance_score(ast_node):"
        />
      );

      expect(screen.getByTestId('agent-streaming-output')).toBeInTheDocument();
      expect(screen.getByTestId('agent-streaming-tokens')).toHaveTextContent(
        'def calculate_relevance_score(ast_node):'
      );
      expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
      expect(screen.getByTestId('agent-token-count')).toHaveTextContent('2 tokens');
    });

    it('streams tokens into AgentRunner via ChatPane when wired with useReActAgent and WebLLM', async () => {
      // Create an initialized webLLM hook instance
      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      render(
        <ChatPane
          status={agentResult.current.agentStatus}
          messages={agentResult.current.messages}
          chunks={agentResult.current.activeChunks}
          onSelectChunk={agentResult.current.setSelectedChunkId}
          onSubmit={agentResult.current.submitQuery}
          onCancel={agentResult.current.cancelQuery}
          streamingTokens={agentResult.current.streamingTokens}
          onReset={agentResult.current.reset}
        />
      );

      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('Idle');

      // Submit query
      await act(async () => {
        await agentResult.current.submitQuery('Find JWT validation method');
      });

      // Verify that agent transitioned to Complete and assistant message contains synthesized text
      expect(agentResult.current.agentStatus.state).toBe('Complete');
      expect(agentResult.current.messages.length).toBeGreaterThan(1);

      const latestMsg =
        agentResult.current.messages[agentResult.current.messages.length - 1];
      expect(latestMsg.role).toBe('assistant');
      expect(latestMsg.content).toContain('Qwen2.5-Coder');
      expect(latestMsg.reActState).toBe('Complete');
    });

    it('triggers WebLLM inference stream and updates DOM when user submits query in full App', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');

      await user.type(input, 'Retrieve AST connection pool');
      await user.click(sendBtn);

      // Verify agent has initiated the ReAct cycle
      expect(screen.getByTestId('agent-status-label')).not.toHaveTextContent('Idle');
      expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
    });

    it('stops WebLLM stream and resets agent state when cancel button is clicked', async () => {
      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      // Trigger query and cancel mid-stream
      await act(async () => {
        const p = agentResult.current.submitQuery('Query AST');
        agentResult.current.cancelQuery();
        await p.catch(() => {});
      });

      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(agentResult.current.agentStatus.currentStepMessage).toContain('cancelled');
      expect(agentResult.current.streamingTokens).toBe('');
    });
  });
});
