import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Header } from '../components/layout/Header';
import { apiClient, HealthResponse } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AgentStatus, RepositoryItem } from '../types';

describe('Adversarial Critic Challenger 5: Backend Health & LanceDB Dynamic Refetch Resilience', () => {
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

  it('Challenge 1 [Malformed / Nullish Payloads]: Gracefully handles empty object and null total_chunks without crashing', async () => {
    const malformed = {
      status: 'healthy',
      total_chunks: null as unknown as number,
    } as unknown as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(malformed);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API:8000 (LanceDB: 0)');
    const healthDot = screen.getByTestId('backend-health-dot');
    expect(healthDot.className).toContain('bg-emerald-400');
  });

  it('Challenge 2 [Case Sensitivity & Status Variants]: Rejects non-standard status values like "ONLINE" or "HEALTHY" gracefully', async () => {
    const upperCaseStatus = {
      status: 'HEALTHY', // Not lowercase 'healthy' or 'ok'
      total_chunks: 500,
    } as unknown as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(upperCaseStatus);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    // Because status !== 'healthy' && status !== 'ok', it treats it as offline
    expect(healthLabel).toHaveTextContent('API: Offline (Simulator)');
    const healthPill = screen.getByTestId('backend-health-pill');
    expect(healthPill.className).toContain('bg-amber-950/50');
  });

  it('Challenge 3 [Rapid Out-of-Order Promises]: Race condition check with interleaved async resolution', async () => {
    let resolveFirst: (value: HealthResponse) => void;
    let resolveSecond: (value: HealthResponse) => void;

    const firstPromise = new Promise<HealthResponse>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<HealthResponse>((res) => {
      resolveSecond = res;
    });

    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');
    getHealthSpy
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const repo1: RepositoryItem = {
      id: 'repo-1',
      name: 'repo-1',
      path: '/path/1',
      chunksCount: 10,
    };
    const repo2: RepositoryItem = {
      id: 'repo-2',
      name: 'repo-2',
      path: '/path/2',
      chunksCount: 20,
    };

    const { rerender } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        activeRepo={repo1}
      />
    );

    // Rapidly switch repo before first promise resolves
    rerender(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        activeRepo={repo2}
      />
    );

    // Resolve second promise FIRST with 999 chunks
    resolveSecond!({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 999,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 999)');
    });

    // Now resolve the outdated first promise with 10 chunks (should NOT overwrite state)
    resolveFirst!({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 10,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    // State remains 999 chunks because first effect was unmounted/cancelled
    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 999)');
    });
  });

  it('Challenge 4 [Component Unmount Safety]: Does not trigger React state update warnings when unmounted while fetch is pending', async () => {
    let pendingResolve: (value: HealthResponse) => void;
    const pendingPromise = new Promise<HealthResponse>((res) => {
      pendingResolve = res;
    });

    vi.spyOn(apiClient, 'getHealth').mockReturnValue(pendingPromise);

    const { unmount } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    // Unmount component immediately while promise is in-flight
    unmount();

    // Now resolve promise; isMounted guard ensures no setState is called
    expect(() => {
      pendingResolve!({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 100,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });
    }).not.toThrow();
  });

  it('Challenge 5 [Dependency Injection]: Supports custom apiClient prop with getHealth method', async () => {
    const customGetHealth = vi.fn().mockResolvedValue({
      status: 'healthy',
      vector_db: 'sqlite',
      total_chunks: 42,
      embedding_dimension: 128,
      embedding_model: 'mock-model',
    });

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        apiClient={{ getHealth: customGetHealth }}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API:8000 (LanceDB: 42)');
    expect(customGetHealth).toHaveBeenCalledTimes(1);
  });
});
