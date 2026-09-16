import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import { useWebLLM, DEFAULT_MODEL, checkWebGPUSupport } from '../hooks/useWebLLM';
import { useReActAgent } from '../hooks/useReActAgent';
import { AgentRunner } from '../components/agent/AgentRunner';
import { ChatPane } from '../components/chat/ChatPane';
import * as webllm from '@mlc-ai/web-llm';

// Helper to create a controllable mock engine
function createControllableMockEngine(options?: {
  tokenStream?: any[];
  streamDelayMs?: number;
  failOnStreamChunkIndex?: number;
  streamError?: Error;
  failGenerate?: boolean;
}) {
  const tokens = options?.tokenStream ?? [
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
  const delay = options?.streamDelayMs ?? 2;

  return {
    chat: {
      completions: {
        create: vi.fn(async ({ messages, stream }: any) => {
          if (options?.failGenerate) {
            throw new Error('WebGPU pipeline execution error during inference');
          }
          if (stream) {
            return (async function* () {
              let idx = 0;
              for (const item of tokens) {
                if (options?.failOnStreamChunkIndex !== undefined && idx === options.failOnStreamChunkIndex) {
                  throw options.streamError ?? new Error('WebGPU device lost: GPU process crashed');
                }
                if (delay > 0) {
                  await new Promise((r) => setTimeout(r, delay));
                }
                idx++;
                if (typeof item === 'string') {
                  yield { choices: [{ delta: { content: item } }] };
                } else {
                  yield item;
                }
              }
            })();
          }
          return {
            choices: [{ message: { content: tokens.join('') } }],
          };
        }),
      },
    },
    reload: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    interruptGenerate: vi.fn().mockResolvedValue(undefined),
  };
}

let activeMockEngine = createControllableMockEngine();

vi.mock('@mlc-ai/web-llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mlc-ai/web-llm')>();
  return {
    ...actual,
    CreateMLCEngine: vi.fn(),
  };
});

describe('Empirical Challenger: WebLLM Edge Inference Adversarial Stress Suite', () => {
  const defaultGpuMock = {
    requestAdapter: vi.fn().mockResolvedValue({
      requestDevice: vi.fn().mockResolvedValue({}),
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    activeMockEngine = createControllableMockEngine();

    vi.mocked(webllm.CreateMLCEngine).mockImplementation(
      async (modelId: string | string[], config?: any) => {
        const id = Array.isArray(modelId) ? modelId[0] : modelId;
        if (config?.initProgressCallback) {
          config.initProgressCallback({
            progress: 0.25,
            timeElapsed: 0.1,
            text: `Loading ${id}...`,
          });
          config.initProgressCallback({
            progress: 1.0,
            timeElapsed: 0.5,
            text: `WebLLM ready: ${id}`,
          });
        }
        return activeMockEngine as any;
      }
    );

    Object.defineProperty(navigator, 'gpu', {
      value: defaultGpuMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'gpu', {
      value: defaultGpuMock,
      writable: true,
      configurable: true,
    });
  });

  // =========================================================================
  // SUITE 1: Rapid Concurrent Calls & Race Conditions
  // =========================================================================
  describe('1. Rapid Concurrent Calls & Concurrency Guards', () => {
    it('handles 10 rapid concurrent initEngine() invocations without corrupted state', async () => {
      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        const promises = Array.from({ length: 10 }).map(() => result.current.initEngine());
        await Promise.all(promises);
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.progress).toBe(100);
      expect(result.current.currentModel).toBe(DEFAULT_MODEL);
      expect(result.current.error).toBeNull();
      expect(result.current.engine).toBeDefined();
    });

    it('handles multiple concurrent generate() calls cleanly returning generated outputs', async () => {
      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      const results: string[] = [];
      await act(async () => {
        const p1 = result.current.generate('Query 1').then((r) => results.push(r));
        const p2 = result.current.generate('Query 2').then((r) => results.push(r));
        const p3 = result.current.generate('Query 3').then((r) => results.push(r));
        await Promise.all([p1, p2, p3]);
      });

      expect(results.length).toBe(3);
      results.forEach((res) => {
        expect(res).toContain('Qwen2.5-Coder');
      });
      expect(result.current.status).toBe('ready');
    });

    it('rejects generate() when called concurrently while initEngine() is in-flight', async () => {
      const { result } = renderHook(() => useWebLLM());

      let caughtGenerateError: any;
      await act(async () => {
        const initP = result.current.initEngine();
        const genP = result.current.generate('Prompt while loading').catch((e) => {
          caughtGenerateError = e;
        });
        await Promise.all([initP, genP]);
      });

      expect(caughtGenerateError).toBeDefined();
      expect(caughtGenerateError.message).toMatch(/WebLLM engine is not loaded/);
      expect(result.current.status).toBe('ready');
    });

    it('survives 20 rapid bursts of interrupt() while generate() is actively streaming', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: Array.from({ length: 20 }).map((_, i) => `token_${i} `),
        streamDelayMs: 10,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      await act(async () => {
        const genP = result.current.generate('Prompt under interrupt assault');
        for (let i = 0; i < 20; i++) {
          result.current.interrupt();
        }
        await genP;
      });

      expect(activeMockEngine.interruptGenerate).toHaveBeenCalled();
      expect(result.current.status).toBe('ready');
    });
  });

  // =========================================================================
  // SUITE 2: Extreme Stream Chunks & Malformed Payloads
  // =========================================================================
  describe('2. Extreme Stream Chunks & Malformed Payloads', () => {
    it('handles empty strings, whitespace, and newlines in stream chunks without dropping content', async () => {
      const streamWithEmpties = ['', '  ', '\n\n', '', 'def ', '', 'calculate():', '\n    ', 'pass', ''];
      activeMockEngine = createControllableMockEngine({
        tokenStream: streamWithEmpties,
        streamDelayMs: 1,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      const receivedDeltas: string[] = [];
      let finalAccumulated = '';

      await act(async () => {
        finalAccumulated = await result.current.generate('Test empty chunks', (delta, acc) => {
          receivedDeltas.push(delta);
        });
      });

      expect(finalAccumulated).toBe('  \n\ndef calculate():\n    pass');
      expect(result.current.status).toBe('ready');
    });

    it('handles huge monolithic text payloads (300,000 characters) across chunks without truncation', async () => {
      const largeChunk1 = 'A'.repeat(100000);
      const largeChunk2 = 'B'.repeat(100000);
      const largeChunk3 = 'C'.repeat(100000);

      activeMockEngine = createControllableMockEngine({
        tokenStream: [largeChunk1, largeChunk2, largeChunk3],
        streamDelayMs: 1,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let totalOutput = '';
      await act(async () => {
        totalOutput = await result.current.generate('Huge chunk test');
      });

      expect(totalOutput.length).toBe(300000);
      expect(totalOutput.slice(0, 5)).toBe('AAAAA');
      expect(totalOutput.slice(100000, 100005)).toBe('BBBBB');
      expect(totalOutput.slice(200000, 200005)).toBe('CCCCC');
    });

    it('safely handles malformed chunk objects with missing choices, null deltas, or empty objects', async () => {
      const malformedStream = [
        {},
        { choices: [] },
        { choices: [{ delta: null }] },
        { choices: [{ delta: { content: null } }] },
        { choices: [{ delta: { content: undefined } }] },
        { choices: [{ delta: { content: 'Recovered ' } }] },
        { choices: null },
        { choices: [{ delta: { content: 'AST code' } }] },
      ];

      activeMockEngine = createControllableMockEngine({
        tokenStream: malformedStream,
        streamDelayMs: 1,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let output = '';
      await act(async () => {
        output = await result.current.generate('Malformed chunk test');
      });

      expect(output).toBe('Recovered AST code');
      expect(result.current.status).toBe('ready');
    });

    it('handles non-string deltas (numbers, booleans) in stream chunks without crashing', async () => {
      const nonStringStream = [
        { choices: [{ delta: { content: 123 } }] },
        { choices: [{ delta: { content: ' - ' } }] },
        { choices: [{ delta: { content: true } }] },
        { choices: [{ delta: { content: ' status' } }] },
      ];

      activeMockEngine = createControllableMockEngine({
        tokenStream: nonStringStream,
        streamDelayMs: 1,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let output = '';
      await act(async () => {
        output = await result.current.generate('Non string stream');
      });

      expect(output).toContain('123 - true status');
      expect(result.current.status).toBe('ready');
    });

    it('accurately accumulates 500 rapid sequential token stream iterations in exact FIFO order', async () => {
      const fiveHundredTokens = Array.from({ length: 500 }).map((_, i) => `${i},`);
      activeMockEngine = createControllableMockEngine({
        tokenStream: fiveHundredTokens,
        streamDelayMs: 0,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let accumulated = '';
      await act(async () => {
        accumulated = await result.current.generate('500 tokens test');
      });

      const expected = fiveHundredTokens.join('');
      expect(accumulated).toBe(expected);
      expect(result.current.status).toBe('ready');
    });
  });

  // =========================================================================
  // SUITE 3: Model Reloading While Generation is Active
  // =========================================================================
  describe('3. Model Reloading & Lifecycle Transitions', () => {
    it('supports reloading a new model while engine was instantiated', async () => {
      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });
      expect(result.current.currentModel).toBe(DEFAULT_MODEL);

      await act(async () => {
        await result.current.loadModel('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      });

      expect(activeMockEngine.reload).toHaveBeenCalledWith('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      expect(result.current.status).toBe('ready');
    });

    it('handles model reloading triggered while generate() is actively streaming in-flight', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: Array.from({ length: 25 }).map((_, i) => `tok_${i} `),
        streamDelayMs: 10,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      await act(async () => {
        const genP = result.current.generate('In-flight prompt');
        const reloadP = result.current.loadModel('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
        await Promise.allSettled([genP, reloadP]);
      });

      expect(activeMockEngine.reload).toHaveBeenCalledWith('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
      expect(result.current.status).toBe('ready');
    });

    it('documents lifecycle race condition when unload() is invoked concurrently with in-flight generate()', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: Array.from({ length: 25 }).map((_, i) => `tok_${i} `),
        streamDelayMs: 10,
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      await act(async () => {
        const genP = result.current.generate('In-flight prompt to unload');
        const unloadP = result.current.unload();
        await Promise.allSettled([genP, unloadP]);
      });

      expect(activeMockEngine.unload).toHaveBeenCalled();
      // Engine instance reference was cleanly cleared
      expect(result.current.engine).toBeNull();
      // Status safely settles in a valid lifecycle state
      expect(['ready', 'unloaded']).toContain(result.current.status);
    });

    it('unloads engine cleanly and resets state to unloaded upon unload()', async () => {
      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      await act(async () => {
        await result.current.unload();
      });

      expect(activeMockEngine.unload).toHaveBeenCalled();
      expect(result.current.status).toBe('unloaded');
      expect(result.current.engine).toBeNull();
      expect(result.current.progress).toBe(0);

      await expect(
        act(async () => {
          await result.current.generate('After unload');
        })
      ).rejects.toThrow(/WebLLM engine is not loaded/);
    });

    it('survives rapid model switching sequence between 3 different model IDs', async () => {
      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine('model-v1');
        await result.current.loadModel('model-v2');
        await result.current.loadModel('model-v3');
      });

      expect(result.current.currentModel).toBe('model-v3');
      expect(result.current.status).toBe('ready');
    });
  });

  // =========================================================================
  // SUITE 4: WebGPU Failure & Error Recovery Under Simulated OOM
  // =========================================================================
  describe('4. WebGPU Failure & Error Recovery Under Simulated OOM', () => {
    it('recovers from an initial Out-of-Memory (OOM) load failure when retrying with a smaller model', async () => {
      vi.mocked(webllm.CreateMLCEngine).mockRejectedValueOnce(
        new Error('Out of memory: GPU buffer allocation failed (16384 MB required)')
      );

      const { result } = renderHook(() => useWebLLM());

      await act(async () => {
        try {
          await result.current.initEngine('Qwen2.5-Coder-32B-Instruct-q4f16_1-MLC');
        } catch (e) {
          // Expected OOM
        }
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Out of memory');

      // Retry with smaller model
      await act(async () => {
        await result.current.loadModel('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
      expect(result.current.currentModel).toBe('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');

      let genResult = '';
      await act(async () => {
        genResult = await result.current.generate('Test recovery');
      });
      expect(genResult).toContain('Qwen2.5-Coder');
    });

    it('catches mid-stream GPU device crash and allows engine re-initialization', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: ['token1', 'token2', 'token3', 'token4'],
        failOnStreamChunkIndex: 2,
        streamError: new Error('GPUDevice lost: Device was lost due to execution timeout'),
      });

      const { result } = renderHook(() => useWebLLM());
      await act(async () => {
        await result.current.initEngine();
      });

      let caughtErr: any;
      await act(async () => {
        try {
          await result.current.generate('Prompt destined to crash');
        } catch (e) {
          caughtErr = e;
        }
      });

      expect(caughtErr).toBeDefined();
      expect(caughtErr.message).toContain('GPUDevice lost');
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('GPUDevice lost');

      // Reset engine with healthy mock and re-init
      activeMockEngine = createControllableMockEngine();
      await act(async () => {
        await result.current.initEngine();
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
    });

    it('recovers when navigator.gpu was initially missing and later becomes available', async () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useWebLLM());
      expect(result.current.status).toBe('error');
      expect(result.current.isWebGPUSupported).toBe(false);

      // Restore navigator.gpu
      Object.defineProperty(navigator, 'gpu', {
        value: defaultGpuMock,
        writable: true,
        configurable: true,
      });

      await act(async () => {
        await result.current.loadModel();
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 5: Component Unmounting Mid-Stream & StrictMode Resilience
  // =========================================================================
  describe('5. Component Unmounting Mid-Stream & StrictMode Resilience', () => {
    it('survives component unmounting while generate() is actively streaming', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: Array.from({ length: 20 }).map((_, i) => `chunk_${i} `),
        streamDelayMs: 10,
      });

      let hookInstance: any;
      function TestConsumer() {
        hookInstance = useWebLLM();
        return <div data-testid="consumer">{hookInstance.status}</div>;
      }

      const { unmount } = render(<TestConsumer />);

      await act(async () => {
        await hookInstance.initEngine();
      });

      await act(async () => {
        const genP = hookInstance.generate('Unmount test query');
        unmount();
        try {
          await genP;
        } catch (e) {
          // ignore error if unmounted
        }
      });

      expect(document.querySelector('[data-testid="consumer"]')).toBeNull();
    });

    it('handles query cancellation mid-WebLLM generation and halts token accumulation cleanly', async () => {
      activeMockEngine = createControllableMockEngine({
        tokenStream: Array.from({ length: 40 }).map((_, i) => `token_${i} `),
        streamDelayMs: 20,
      });

      const { result: llmResult } = renderHook(() => useWebLLM());
      await act(async () => {
        await llmResult.current.initEngine();
      });

      const { result: agentResult } = renderHook(() =>
        useReActAgent({ webLLM: llmResult.current })
      );

      // Submit query
      let queryP: Promise<void>;
      act(() => {
        queryP = agentResult.current.submitQuery('Search JWT authentication code');
      });

      // Wait a moment for agent to enter ReAct cycle
      await new Promise((r) => setTimeout(r, 50));

      // Cancel query mid-execution
      await act(async () => {
        agentResult.current.cancelQuery();
        await queryP.catch(() => {});
      });

      expect(agentResult.current.agentStatus.state).toBe('Idle');
      expect(agentResult.current.agentStatus.currentStepMessage).toContain('cancelled');
      expect(agentResult.current.streamingTokens).toBe('');
      expect(activeMockEngine.interruptGenerate).toHaveBeenCalled();
    });

    it('survives 25 rapid mount/unmount cycles in succession without DOM or state corruption', () => {
      for (let i = 0; i < 25; i++) {
        const { unmount } = render(
          <AgentRunner
            state={i % 2 === 0 ? 'synthesizing' : 'thinking'}
            streamingTokens={i % 2 === 0 ? `Live token stream iteration ${i}` : ''}
          />
        );
        expect(screen.getByTestId('agent-runner')).toBeInTheDocument();
        unmount();
      }
      expect(document.querySelector('[data-testid="agent-runner"]')).toBeNull();
    });
  });
});
