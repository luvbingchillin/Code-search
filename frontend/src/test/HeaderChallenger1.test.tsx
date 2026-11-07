import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { Header } from '../components/layout/Header';
import { apiClient, HealthResponse } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AgentStatus, RepositoryItem } from '../types';

describe('Header Empirical Challenger Suite 1: Milestone 5 Adversarial Stress Testing', () => {
  let mockWebLLM: UseWebLLMReturn;
  let mockNemoIR: UseNemoIRReturn;
  const mockAgentStatus: AgentStatus = {
    state: 'Idle',
    currentStepMessage: 'Ready',
    elapsedMs: 0,
    activeChunkCount: 0,
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockWebLLM = {
      status: 'ready',
      progress: 1,
      progressText: 'Ready',
      currentModel: 'Qwen2.5-Coder',
      error: null,
      isWebGPUSupported: true,
      engine: {},
      loadModel: vi.fn(),
      generate: vi.fn().mockResolvedValue('OK'),
      generateStream: vi.fn(),
      initEngine: vi.fn(),
      interrupt: vi.fn(),
      unload: vi.fn(),
    };

    mockNemoIR = {
      wasmStatus: 'ready',
      isReady: true,
      initNemo: vi.fn(),
      searchAstChunks: vi.fn().mockResolvedValue([]),
      lookupEntity: vi.fn(),
      executeWorkflow: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Hypothesis 1: Rapid consecutive trigger updates & out-of-order latency
  // =========================================================================
  describe('Hypothesis 1: Rapid consecutive trigger updates do not cause race conditions or outdated counts', () => {
    it('handles out-of-order asynchronous responses (latency inversion) without state clobbering', async () => {
      // Simulate 3 trigger updates with inverted response times:
      // Trigger 0 (first request): resolves after 150ms with 100 chunks
      // Trigger 1 (second request): resolves after 80ms with 250 chunks
      // Trigger 2 (third request): resolves after 20ms with 999 chunks
      let callCount = 0;
      vi.spyOn(apiClient, 'getHealth').mockImplementation(() => {
        callCount++;
        const currentCall = callCount;
        if (currentCall === 1) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 'healthy',
                  vector_db: 'lancedb',
                  total_chunks: 100,
                  embedding_dimension: 384,
                  embedding_model: 'all-MiniLM-L6-v2',
                }),
              150
            )
          );
        }
        if (currentCall === 2) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 'healthy',
                  vector_db: 'lancedb',
                  total_chunks: 250,
                  embedding_dimension: 384,
                  embedding_model: 'all-MiniLM-L6-v2',
                }),
              80
            )
          );
        }
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                status: 'healthy',
                vector_db: 'lancedb',
                total_chunks: 999,
                embedding_dimension: 384,
                embedding_model: 'all-MiniLM-L6-v2',
              }),
            20
          )
        );
      });

      const { rerender } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={0}
        />
      );

      // Rapidly fire trigger 1 and 2
      act(() => {
        rerender(
          <Header
            webLLM={mockWebLLM}
            nemoIR={mockNemoIR}
            agentStatus={mockAgentStatus}
            healthRefreshTrigger={1}
          />
        );
      });

      act(() => {
        rerender(
          <Header
            webLLM={mockWebLLM}
            nemoIR={mockNemoIR}
            agentStatus={mockAgentStatus}
            healthRefreshTrigger={2}
          />
        );
      });

      // The 3rd request should resolve first (after ~20ms)
      await waitFor(
        () => {
          expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 999)');
        },
        { timeout: 1000 }
      );

      // Wait beyond the 150ms window when the 1st and 2nd slow requests finish
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert that slower outdated responses DID NOT clobber the latest result (999)
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 999)');
    });

    it('handles a burst of 10 consecutive rapid trigger increments', async () => {
      let callIndex = 0;
      vi.spyOn(apiClient, 'getHealth').mockImplementation(async () => {
        callIndex++;
        const chunks = callIndex * 10;
        return {
          status: 'healthy',
          vector_db: 'lancedb',
          total_chunks: chunks,
          embedding_dimension: 384,
          embedding_model: 'all-MiniLM-L6-v2',
        };
      });

      const { rerender } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={0}
        />
      );

      for (let i = 1; i <= 10; i++) {
        rerender(
          <Header
            webLLM={mockWebLLM}
            nemoIR={mockNemoIR}
            agentStatus={mockAgentStatus}
            healthRefreshTrigger={i}
          />
        );
      }

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 110)');
      });
    });
  });

  // =========================================================================
  // Hypothesis 2: Flapping backend status (healthy -> error -> healthy -> error)
  // =========================================================================
  describe('Hypothesis 2: Flapping backend status transitions classes and labels cleanly without crashing', () => {
    it('transitions through a 6-phase flapping sequence with correct DOM tokens and attributes', async () => {
      const flapStates: Array<{
        type: 'healthy' | 'error' | 'ok' | 'degraded' | 'throw';
        chunks?: number;
      }> = [
        { type: 'healthy', chunks: 120 },
        { type: 'error' },
        { type: 'ok', chunks: 450 },
        { type: 'degraded', chunks: 0 },
        { type: 'healthy', chunks: 888 },
        { type: 'throw' },
      ];

      let currentIndex = 0;
      vi.spyOn(apiClient, 'getHealth').mockImplementation(async () => {
        const current = flapStates[currentIndex];
        if (current.type === 'throw') {
          throw new TypeError('Network connection refused');
        }
        if (current.type === 'error') {
          return Promise.reject(new Error('Connection reset by peer'));
        }
        if (current.type === 'degraded') {
          return {
            status: 'degraded',
            vector_db: 'none',
            total_chunks: 0,
            embedding_dimension: 0,
            embedding_model: 'none',
          } as HealthResponse;
        }
        return {
          status: current.type,
          vector_db: 'lancedb',
          total_chunks: current.chunks ?? 0,
          embedding_dimension: 384,
          embedding_model: 'all-MiniLM-L6-v2',
        };
      });

      const { rerender } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={0}
        />
      );

      // Phase 0: Initial healthy (120 chunks)
      await waitFor(() => {
        const pill = screen.getByTestId('backend-health-pill');
        const dot = screen.getByTestId('backend-health-dot');
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API:8000 (LanceDB: 120)');
        expect(pill.className).toContain('bg-emerald-950/50');
        expect(pill.className).toContain('text-emerald-300');
        expect(dot.className).toContain('bg-emerald-400');
        expect(dot.className).toContain('animate-pulse');
        expect(pill.getAttribute('title')).toContain('120 indexed chunks in LanceDB');
      });

      // Phase 1: Flap to network error rejection
      currentIndex = 1;
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={1}
        />
      );

      await waitFor(() => {
        const pill = screen.getByTestId('backend-health-pill');
        const dot = screen.getByTestId('backend-health-dot');
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API: Offline (Simulator)');
        expect(pill.className).toContain('bg-amber-950/50');
        expect(pill.className).toContain('text-amber-300');
        expect(dot.className).toContain('bg-amber-400');
        expect(dot.className).not.toContain('animate-pulse');
        expect(pill.getAttribute('title')).toContain('simulator mode');
      });

      // Phase 2: Flap back to online with status 'ok' (450 chunks)
      currentIndex = 2;
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={2}
        />
      );

      await waitFor(() => {
        const pill = screen.getByTestId('backend-health-pill');
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API:8000 (LanceDB: 450)');
        expect(pill.className).toContain('bg-emerald-950/50');
      });

      // Phase 3: Flap to degraded status (treated as offline)
      currentIndex = 3;
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={3}
        />
      );

      await waitFor(() => {
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API: Offline (Simulator)');
      });

      // Phase 4: Flap back to healthy (888 chunks)
      currentIndex = 4;
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={4}
        />
      );

      await waitFor(() => {
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API:8000 (LanceDB: 888)');
      });

      // Phase 5: Flap to hard thrown exception
      currentIndex = 5;
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          healthRefreshTrigger={5}
        />
      );

      await waitFor(() => {
        const label = screen.getByTestId('backend-health-label');
        expect(label).toHaveTextContent('API: Offline (Simulator)');
      });
    });
  });

  // =========================================================================
  // Hypothesis 3: Unmount during in-flight getHealth() promise
  // =========================================================================
  describe('Hypothesis 3: Unmount during in-flight getHealth() produces zero React warnings', () => {
    it('unmounting while getHealth() promise is in-flight does not cause unmounted state updates or warnings', async () => {
      let resolvePromise: (value: HealthResponse) => void;
      const deferredPromise = new Promise<HealthResponse>((resolve) => {
        resolvePromise = resolve;
      });

      vi.spyOn(apiClient, 'getHealth').mockReturnValue(deferredPromise);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      // Unmount the component while the promise is still pending
      unmount();

      // Resolve the deferred promise AFTER unmount
      await act(async () => {
        resolvePromise!({
          status: 'healthy',
          vector_db: 'lancedb',
          total_chunks: 500,
          embedding_dimension: 384,
          embedding_model: 'all-MiniLM-L6-v2',
        });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Assert that zero state-update warnings were logged to console
      const unmountedWarnings = [...consoleWarnSpy.mock.calls, ...consoleErrorSpy.mock.calls].filter(
        (call) =>
          call.some(
            (arg) =>
              typeof arg === 'string' &&
              (arg.includes("Can't perform a React state update on an unmounted component") ||
                arg.includes('memory leak') ||
                arg.includes('unmounted'))
          )
      );
      expect(unmountedWarnings).toHaveLength(0);
    });

    it('unmounting while getHealth() promise rejects does not emit unhandled rejection or unmounted state warnings', async () => {
      let rejectPromise: (err: any) => void;
      const deferredPromise = new Promise<HealthResponse>((_, reject) => {
        rejectPromise = reject;
      });

      vi.spyOn(apiClient, 'getHealth').mockReturnValue(deferredPromise);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      // Unmount while pending
      unmount();

      // Reject the promise AFTER unmount
      await act(async () => {
        rejectPromise!(new Error('Aborted network connection'));
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update")
      );
    });
  });

  // =========================================================================
  // Hypothesis 4: Extreme chunk counts and missing/malformed fields
  // =========================================================================
  describe('Hypothesis 4: Backend responding with extreme chunk counts or missing fields renders properly', () => {
    it('renders correctly with 0 chunk count', async () => {
      vi.spyOn(apiClient, 'getHealth').mockResolvedValue({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 0,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

      render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 0)');
        expect(screen.getByTestId('backend-health-pill').getAttribute('title')).toContain(
          '0 indexed chunks in LanceDB'
        );
      });
    });

    it('renders massive chunk count (10,000,000) without crashing or overflowing layout', async () => {
      vi.spyOn(apiClient, 'getHealth').mockResolvedValue({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 10000000,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

      render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 10000000)');
        expect(screen.getByTestId('backend-health-pill').getAttribute('title')).toContain(
          '10000000 indexed chunks in LanceDB'
        );
      });
    });

    it('safely defaults missing or null total_chunks to 0', async () => {
      const responseWithoutChunks = {
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: null,
      } as unknown as HealthResponse;

      vi.spyOn(apiClient, 'getHealth').mockResolvedValue(responseWithoutChunks);

      render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 0)');
      });
    });

    it('handles completely malformed response (empty object / null) gracefully without throwing', async () => {
      // Backend returns null or empty object unexpectedly
      vi.spyOn(apiClient, 'getHealth').mockResolvedValue({} as any);

      render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
        />
      );

      await waitFor(() => {
        // Since status is undefined (neither 'healthy' nor 'ok'), falls back to offline simulator
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API: Offline (Simulator)');
      });
    });
  });

  // =========================================================================
  // Hypothesis 5: Prop dynamics & Custom client injection
  // =========================================================================
  describe('Hypothesis 5: Custom apiClient prop injection and dynamic re-querying', () => {
    it('supports custom apiClient injection and updates when client prop changes', async () => {
      const customClientA = {
        getHealth: vi.fn().mockResolvedValue({
          status: 'healthy' as const,
          vector_db: 'lancedb',
          total_chunks: 111,
          embedding_dimension: 384,
          embedding_model: 'all-MiniLM-L6-v2',
        }),
      };

      const customClientB = {
        getHealth: vi.fn().mockResolvedValue({
          status: 'healthy' as const,
          vector_db: 'lancedb',
          total_chunks: 222,
          embedding_dimension: 384,
          embedding_model: 'all-MiniLM-L6-v2',
        }),
      };

      const { rerender } = render(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          apiClient={customClientA}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 111)');
      });
      expect(customClientA.getHealth).toHaveBeenCalledTimes(1);

      // Swap to customClientB
      rerender(
        <Header
          webLLM={mockWebLLM}
          nemoIR={mockNemoIR}
          agentStatus={mockAgentStatus}
          apiClient={customClientB}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 222)');
      });
      expect(customClientB.getHealth).toHaveBeenCalledTimes(1);
    });
  });
});
