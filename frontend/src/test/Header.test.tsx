import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Header } from '../components/layout/Header';
import { App } from '../App';
import { apiClient, HealthResponse } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AgentStatus, RepositoryItem } from '../types';

describe('Header Backend Health & LanceDB Status Indicator Suite (Requirement R5)', () => {
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

  it('renders online status pill with API:8000 (LanceDB: <count>) when backend is healthy', async () => {
    const healthData: HealthResponse = {
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 284,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    };
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(healthData);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const healthPill = await screen.findByTestId('backend-health-pill');
    expect(healthPill).toBeInTheDocument();

    const healthLabel = screen.getByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API:8000 (LanceDB: 284)');

    const healthDot = screen.getByTestId('backend-health-dot');
    expect(healthDot.className).toContain('bg-emerald-400');
    expect(healthDot.className).toContain('animate-pulse');

    // Neo-tactile brutalist color tokens
    expect(healthPill.className).toContain('bg-emerald-950/50');
    expect(healthPill.className).toContain('text-emerald-300');
    expect(healthPill.className).toContain('border-emerald-600/70');
  });

  it('renders online status pill when backend returns status "ok" and handles undefined total_chunks as 0', async () => {
    const healthData = {
      status: 'ok',
      vector_db: 'lancedb',
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    } as unknown as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(healthData);

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

  it('renders offline status pill with API: Offline (Simulator) when getHealth() rejects', async () => {
    vi.spyOn(apiClient, 'getHealth').mockRejectedValue(new Error('Connection refused: localhost:8000'));

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API: Offline (Simulator)');

    const healthPill = screen.getByTestId('backend-health-pill');
    expect(healthPill.className).toContain('bg-amber-950/50');
    expect(healthPill.className).toContain('text-amber-300');
    expect(healthPill.className).toContain('border-amber-600/70');

    const healthDot = screen.getByTestId('backend-health-dot');
    expect(healthDot.className).toContain('bg-amber-400');
    expect(healthDot.className).not.toContain('animate-pulse');
  });

  it('renders offline status pill when backend returns non-healthy status (e.g. "degraded")', async () => {
    const degradedData = {
      status: 'degraded',
      vector_db: 'none',
      total_chunks: 0,
      embedding_dimension: 0,
      embedding_model: 'none',
    } as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(degradedData);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API: Offline (Simulator)');

    const healthPill = screen.getByTestId('backend-health-pill');
    expect(healthPill.className).toContain('bg-amber-950/50');
  });

  it('re-fetches backend health when healthRefreshTrigger changes', async () => {
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');
    getHealthSpy
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 10,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      })
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 125,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

    const { rerender } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        healthRefreshTrigger={0}
      />
    );

    const healthLabel = await screen.findByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API:8000 (LanceDB: 10)');
    expect(getHealthSpy).toHaveBeenCalledTimes(1);

    // Increment trigger to simulate post-indexing event
    rerender(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        healthRefreshTrigger={1}
      />
    );

    await waitFor(() => {
      expect(getHealthSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 125)');
    });
  });

  it('re-fetches backend health when activeRepo changes', async () => {
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');
    getHealthSpy
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 50,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      })
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 284,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

    const repo1: RepositoryItem = {
      id: 'repo-1',
      name: 'sample/repo-1',
      path: 'fixtures/sample_repo_1',
      chunksCount: 50,
    };

    const repo2: RepositoryItem = {
      id: 'repo-2',
      name: 'psf/requests',
      path: 'fixtures/requests',
      chunksCount: 284,
    };

    const { rerender } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        activeRepo={repo1}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 50)');
    });
    expect(getHealthSpy).toHaveBeenCalledTimes(1);

    // Switch repo
    rerender(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        activeRepo={repo2}
      />
    );

    await waitFor(() => {
      expect(getHealthSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 284)');
    });
  });

  it('recovers dynamically from offline error to online status on next refresh', async () => {
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');
    getHealthSpy
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 99,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

    const { rerender } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        healthRefreshTrigger={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API: Offline (Simulator)');
    });

    // Trigger refresh after backend comes online
    rerender(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        healthRefreshTrigger={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 99)');
    });
  });

  it('integrates cleanly in full App component and mounts live health indicator', async () => {
    const user = userEvent.setup();
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth').mockResolvedValue({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 284,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    render(<App />);

    const healthPill = await screen.findByTestId('backend-health-pill');
    expect(healthPill).toBeInTheDocument();

    const healthLabel = screen.getByTestId('backend-health-label');
    expect(healthLabel).toHaveTextContent('API:8000 (LanceDB: 284)');

    expect(getHealthSpy).toHaveBeenCalled();
  });

  it('toggles between Turbo 0.5B and Precision 1.5B via model-tier-toggle-btn', async () => {
    const user = userEvent.setup();
    const loadModelSpy = vi.fn();
    const customWebLLM = {
      ...mockWebLLM,
      currentModel: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      loadModel: loadModelSpy,
    };

    const { rerender } = render(
      <Header
        webLLM={customWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const toggleBtn = screen.getByTestId('model-tier-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Precision 1.5B');

    // Click to switch to Turbo 0.5B
    await user.click(toggleBtn);
    expect(loadModelSpy).toHaveBeenCalledWith('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');

    // Re-render as Turbo 0.5B
    rerender(
      <Header
        webLLM={{
          ...customWebLLM,
          currentModel: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
        }}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    expect(toggleBtn).toHaveTextContent('Turbo 0.5B');

    // Click to switch back to Precision 1.5B
    await user.click(toggleBtn);
    expect(loadModelSpy).toHaveBeenCalledWith('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');
  });
});
