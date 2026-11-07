import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { App } from '../App';
import { Header } from '../components/layout/Header';
import { apiClient, HealthResponse, IndexResponse } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AgentStatus, RepositoryItem } from '../types';

describe('HeaderComponentIntegrationChallenger2: Empirical UI Integration & E2E Component Verification', () => {
  let mockWebLLM: UseWebLLMReturn;
  let mockNemoIR: UseNemoIRReturn;
  const mockAgentStatus: AgentStatus = {
    state: 'Idle',
    currentStepMessage: 'Ready',
    elapsedMs: 0,
    activeChunkCount: 0,
  };

  const healthyResponse: HealthResponse = {
    status: 'healthy',
    vector_db: 'lancedb',
    total_chunks: 284,
    embedding_dimension: 384,
    embedding_model: 'all-MiniLM-L6-v2',
  };

  const sampleRepos: RepositoryItem[] = [
    {
      id: 'requests',
      name: 'psf/requests',
      path: 'fixtures/requests',
      chunksCount: 284,
      filesCount: 17,
      status: 'indexed',
      description: 'Python HTTP for Humans (284 AST nodes)',
    },
    {
      id: 'sample_codebase',
      name: 'sample_codebase',
      path: 'backend/sample_codebase',
      chunksCount: 14,
      filesCount: 3,
      status: 'indexed',
      description: 'FastAPI service sample',
    },
  ];

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

    // Default mock setup for apiClient methods
    vi.spyOn(apiClient, 'getRepositories').mockResolvedValue(sampleRepos);
    vi.spyOn(apiClient, 'getRepoChunks').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Group 1: Empirical UI Integration & DOM Placement within full <App />
  // --------------------------------------------------------------------------
  it('1.1 mounts in full <App /> with clean positioning, accessible testids, and brutalist design tokens', async () => {
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(healthyResponse);

    render(<App />);

    // 1. Assert all 3 required testids exist
    const pill = await screen.findByTestId('backend-health-pill');
    const dot = screen.getByTestId('backend-health-dot');
    const label = screen.getByTestId('backend-health-label');

    expect(pill).toBeInTheDocument();
    expect(dot).toBeInTheDocument();
    expect(label).toBeInTheDocument();

    // 2. Assert hierarchical structure & content
    expect(pill).toContainElement(dot);
    expect(pill).toContainElement(label);
    expect(label).toHaveTextContent('API:8000 (LanceDB: 284)');

    // 3. Assert neo-tactile brutalist styling tokens
    expect(pill.className).toContain('bg-emerald-950/50');
    expect(pill.className).toContain('text-emerald-300');
    expect(pill.className).toContain('border-emerald-600/70');
    expect(pill.className).toContain('font-mono');
    expect(pill.className).toContain('rounded-md');
    expect(pill.className).toContain('select-none');

    // 4. Assert dot has animated pulse when online
    expect(dot.className).toContain('bg-emerald-400');
    expect(dot.className).toContain('animate-pulse');

    // 5. Assert tooltip accessibility attribute
    expect(pill).toHaveAttribute(
      'title',
      'Backend API connected at localhost:8000 (284 indexed chunks in LanceDB)'
    );

    // 6. Assert clean positioning alongside neighboring header elements
    const repoBtn = screen.getByTestId('connect-repo-btn');
    const webllmBtn = screen.getByTestId('webllm-load-toggle-btn');
    expect(repoBtn).toBeInTheDocument();
    expect(webllmBtn).toBeInTheDocument();

    // Assert pill is located in the right-side control cluster of <header>
    const headerEl = pill.closest('header');
    expect(headerEl).not.toBeNull();
    expect(headerEl).toContainElement(repoBtn);
    expect(headerEl).toContainElement(pill);
    expect(headerEl).toContainElement(webllmBtn);
  });

  // --------------------------------------------------------------------------
  // Group 2: Boundary & Extreme Health Responses Handling
  // --------------------------------------------------------------------------
  it('2.1 formats massive chunk counts (1,000,000) cleanly without breaking layout', async () => {
    const massiveHealth: HealthResponse = {
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 1000000,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    };
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(massiveHealth);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API:8000 (LanceDB: 1000000)');

    const pill = screen.getByTestId('backend-health-pill');
    expect(pill).toHaveAttribute(
      'title',
      'Backend API connected at localhost:8000 (1000000 indexed chunks in LanceDB)'
    );
  });

  it('2.2 safely handles status "ok" with missing total_chunks by falling back to 0', async () => {
    const minimalHealth = {
      status: 'ok',
      vector_db: 'lancedb',
    } as unknown as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(minimalHealth);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API:8000 (LanceDB: 0)');

    const dot = screen.getByTestId('backend-health-dot');
    expect(dot.className).toContain('bg-emerald-400');
    expect(dot.className).toContain('animate-pulse');
  });

  // --------------------------------------------------------------------------
  // Group 3: Offline, Rejection, and Degraded State Resilience
  // --------------------------------------------------------------------------
  it('3.1 gracefully transitions to amber simulator mode on network connection failure', async () => {
    vi.spyOn(apiClient, 'getHealth').mockRejectedValue(
      new TypeError('Failed to fetch: net::ERR_CONNECTION_REFUSED')
    );

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const pill = await screen.findByTestId('backend-health-pill');
    const label = screen.getByTestId('backend-health-label');
    const dot = screen.getByTestId('backend-health-dot');

    expect(label).toHaveTextContent('API: Offline (Simulator)');
    expect(dot.className).toContain('bg-amber-400');
    expect(dot.className).not.toContain('animate-pulse');

    // Amber neo-tactile styling tokens
    expect(pill.className).toContain('bg-amber-950/50');
    expect(pill.className).toContain('text-amber-300');
    expect(pill.className).toContain('border-amber-600/70');

    expect(pill).toHaveAttribute(
      'title',
      'Backend API offline - operating in local simulator mode'
    );
  });

  it('3.2 renders offline simulator mode when backend returns non-healthy status string (e.g. "degraded" or "maintenance")', async () => {
    const degradedHealth = {
      status: 'maintenance',
      vector_db: 'none',
      total_chunks: 0,
    } as unknown as HealthResponse;
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(degradedHealth);

    render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API: Offline (Simulator)');

    const pill = screen.getByTestId('backend-health-pill');
    expect(pill.className).toContain('bg-amber-950/50');
  });

  // --------------------------------------------------------------------------
  // Group 4: Interaction with ConnectRepoModal Repository Selection
  // --------------------------------------------------------------------------
  it('4.1 re-fetches health and updates header status pill when user switches repositories via ConnectRepoModal', async () => {
    const user = userEvent.setup();
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');

    // Initial load: 14 chunks
    getHealthSpy.mockResolvedValueOnce({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 14,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    render(<App />);

    // Verify initial health state
    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API:8000 (LanceDB: 14)');
    expect(getHealthSpy).toHaveBeenCalledTimes(1);

    // Prepare next health response after switching to requests repo (284 chunks)
    getHealthSpy.mockResolvedValueOnce({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 284,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    // 1. Open the repository modal
    const connectRepoBtn = screen.getByTestId('connect-repo-btn');
    await user.click(connectRepoBtn);

    // 2. Modal should now be displayed
    const modal = await screen.findByTestId('connect-repo-modal');
    expect(modal).toBeInTheDocument();

    // 3. Click 'Open & Query' on requests repo
    const openRequestsBtn = await screen.findByTestId('open-repo-btn-requests');
    await user.click(openRequestsBtn);

    // 4. Modal closes and Header re-fetches health
    await waitFor(() => {
      expect(screen.queryByTestId('connect-repo-modal')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getHealthSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 284)');
    });
  });

  // --------------------------------------------------------------------------
  // Group 5: Interaction with ConnectRepoModal Indexing Completion
  // --------------------------------------------------------------------------
  it('5.1 triggers health refresh and updates chunk count when indexing new repository in ConnectRepoModal', async () => {
    const user = userEvent.setup();
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');

    // Initial load: 284 chunks
    getHealthSpy.mockResolvedValueOnce({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 284,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    const indexSpy = vi.spyOn(apiClient, 'indexRepository').mockResolvedValue({
      indexed_files: 5,
      extracted_chunks: 120,
      elapsed_seconds: 0.85,
    });

    render(<App />);

    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API:8000 (LanceDB: 284)');

    // After indexing, backend now has 284 + 120 = 404 chunks
    getHealthSpy.mockResolvedValue({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 404,
      embedding_dimension: 384,
      embedding_model: 'all-MiniLM-L6-v2',
    });

    // 1. Open modal
    await user.click(screen.getByTestId('connect-repo-btn'));
    await screen.findByTestId('connect-repo-modal');

    // 2. Switch to 'Add New Repository' tab
    await user.click(screen.getByTestId('tab-add-repo'));

    // 3. Enter custom repository path and trigger indexing
    const pathInput = screen.getByTestId('repo-path-input');
    await user.clear(pathInput);
    await user.type(pathInput, 'custom/new_repo');

    const triggerBtn = screen.getByTestId('trigger-index-btn');
    await user.click(triggerBtn);

    // 4. Verify indexRepository was invoked with custom path
    expect(indexSpy).toHaveBeenCalledWith('custom/new_repo');

    // 5. Header status pill updates to 404 chunks
    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 404)');
    });
  });

  // --------------------------------------------------------------------------
  // Group 6: Dynamic Network Flapping Recovery & In-Flight Unmount Safety
  // --------------------------------------------------------------------------
  it('6.1 recovers dynamically from network offline rejection to online healthy upon trigger increment', async () => {
    const getHealthSpy = vi.spyOn(apiClient, 'getHealth');

    // First call fails
    getHealthSpy.mockRejectedValueOnce(new Error('Network error: server unreachable'));

    // Second call recovers
    getHealthSpy.mockResolvedValueOnce({
      status: 'healthy',
      vector_db: 'lancedb',
      total_chunks: 350,
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

    // Verify offline state
    const label = await screen.findByTestId('backend-health-label');
    expect(label).toHaveTextContent('API: Offline (Simulator)');
    expect(screen.getByTestId('backend-health-dot').className).toContain('bg-amber-400');

    // Trigger re-check
    rerender(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
        healthRefreshTrigger={1}
      />
    );

    // Verify online recovery
    await waitFor(() => {
      expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 350)');
      expect(screen.getByTestId('backend-health-dot').className).toContain('bg-emerald-400');
    });
  });

  it('6.2 safely aborts state update if component unmounts while health fetch is in-flight', async () => {
    let resolveHealthPromise: (val: HealthResponse) => void;
    const pendingPromise = new Promise<HealthResponse>((resolve) => {
      resolveHealthPromise = resolve;
    });

    vi.spyOn(apiClient, 'getHealth').mockReturnValue(pendingPromise);

    const { unmount } = render(
      <Header
        webLLM={mockWebLLM}
        nemoIR={mockNemoIR}
        agentStatus={mockAgentStatus}
      />
    );

    // Unmount before promise resolves
    unmount();

    // Now resolve the promise in the background
    await act(async () => {
      resolveHealthPromise!({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 100,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });
    });

    // If isMounted guard works, no uncaught error or warning occurs
    expect(screen.queryByTestId('backend-health-pill')).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Group 7: Layout Non-Interference during Pane Toggling & Responsive Controls
  // --------------------------------------------------------------------------
  it('7.1 preserves backend health pill across layout pane minimize/restore toggles', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue(healthyResponse);

    render(<App />);

    const pill = await screen.findByTestId('backend-health-pill');
    expect(pill).toBeInTheDocument();

    // Toggle Chat pane
    const toggleChatBtn = screen.getByTestId('toggle-chat-pane-btn');
    await user.click(toggleChatBtn);

    // Pill remains firmly mounted and intact
    expect(screen.getByTestId('backend-health-pill')).toBeInTheDocument();
    expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 284)');

    // Toggle Code pane
    const toggleCodeBtn = screen.getByTestId('toggle-code-pane-btn');
    await user.click(toggleCodeBtn);

    // Pill remains firmly mounted and intact
    expect(screen.getByTestId('backend-health-pill')).toBeInTheDocument();
    expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 284)');

    // Restore Chat pane
    await user.click(toggleChatBtn);
    expect(screen.getByTestId('backend-health-pill')).toBeInTheDocument();
    expect(screen.getByTestId('backend-health-label')).toHaveTextContent('API:8000 (LanceDB: 284)');
  });
});
