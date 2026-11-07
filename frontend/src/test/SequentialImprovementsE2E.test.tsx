import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiClient, HealthResponse, IndexResponse } from '../services/apiClient';
import { AstCodeChunk, RepositoryItem } from '../types';

describe('Sequential Improvements Consolidated E2E Integration Suite', () => {
  const healthyResponse: HealthResponse = {
    status: 'healthy',
    vector_db: 'lancedb',
    total_chunks: 284,
    embedding_dimension: 384,
    embedding_model: 'all-MiniLM-L6-v2',
  };

  const sampleRepositories: RepositoryItem[] = [
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

  const requestsChunks: AstCodeChunk[] = [
    {
      id: 'chunk-req-send',
      filePath: 'fixtures/requests/sessions.py',
      fileName: 'sessions.py',
      astNodeType: 'FunctionDef',
      identifier: 'Session.send',
      startLine: 600,
      endLine: 650,
      language: 'python',
      repoFullName: 'psf/requests',
      code: 'def send(self, request, **kwargs):\n    """Send a given PreparedRequest."""\n    prep = request\n    return self.build_response(req, resp)',
      relevanceScore: 0.98,
      docstring: 'Send a given PreparedRequest.',
      parameters: ['self', 'request', '**kwargs'],
      calls: ['self.build_response', 'merge_environment_settings'],
      imports: ['urllib3', 'warnings'],
    },
    {
      id: 'chunk-req-build-resp',
      filePath: 'fixtures/requests/adapters.py',
      fileName: 'adapters.py',
      astNodeType: 'FunctionDef',
      identifier: 'build_response',
      startLine: 200,
      endLine: 240,
      language: 'python',
      repoFullName: 'psf/requests',
      code: 'def build_response(self, req, resp):\n    """Builds a Response object."""\n    return resp',
      relevanceScore: 0.92,
      docstring: 'Builds a Response object.',
      parameters: ['self', 'req', 'resp'],
      calls: [],
      imports: ['http.client'],
    },
  ];

  const sampleCodebaseChunks: AstCodeChunk[] = [
    {
      id: 'chunk-calc-1',
      filePath: 'backend/sample_codebase/calculator.py',
      fileName: 'calculator.py',
      astNodeType: 'FunctionDef',
      identifier: 'calculate_statistics',
      startLine: 10,
      endLine: 30,
      language: 'python',
      repoFullName: 'sample_codebase',
      code: 'def calculate_statistics(data):\n    """Compute statistics."""\n    return {"mean": 0}',
      relevanceScore: 0.95,
      docstring: 'Compute statistics.',
      parameters: ['data'],
      calls: ['math.sqrt'],
      imports: ['math'],
    },
  ];

  const calleeChunkMergeEnv: AstCodeChunk = {
    id: 'chunk-req-merge-env',
    filePath: 'fixtures/requests/sessions.py',
    fileName: 'sessions.py',
    astNodeType: 'FunctionDef',
    identifier: 'merge_environment_settings',
    startLine: 700,
    endLine: 730,
    language: 'python',
    repoFullName: 'psf/requests',
    code: 'def merge_environment_settings(url, proxies, stream, verify, cert):\n    """Check environment for proxies and certs."""\n    return {}',
    relevanceScore: 0.85,
    docstring: 'Check environment for proxies and certs.',
    parameters: ['url', 'proxies', 'stream', 'verify', 'cert'],
    calls: [],
    imports: ['os'],
  };

  let searchAstChunksSpy: any;
  let getHealthSpy: any;
  let getRepositoriesSpy: any;
  let getRepoChunksSpy: any;
  let lookupEntitySpy: any;
  let indexRepositorySpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    getHealthSpy = vi.spyOn(apiClient, 'getHealth').mockResolvedValue(healthyResponse);
    getRepositoriesSpy = vi.spyOn(apiClient, 'getRepositories').mockResolvedValue(sampleRepositories);

    getRepoChunksSpy = vi.spyOn(apiClient, 'getRepoChunks').mockImplementation(async (repoId: string) => {
      if (repoId === 'requests') return requestsChunks;
      if (repoId === 'sample_codebase') return sampleCodebaseChunks;
      return [];
    });

    searchAstChunksSpy = vi.spyOn(apiClient, 'searchAstChunks').mockImplementation(
      async (query: string, options?: any) => {
        if (options?.filePath?.includes('requests')) return requestsChunks;
        if (options?.filePath?.includes('sample_codebase')) return sampleCodebaseChunks;
        return requestsChunks;
      }
    );

    lookupEntitySpy = vi.spyOn(apiClient, 'lookupEntity').mockImplementation(async (entityName: string) => {
      if (entityName.includes('merge_environment_settings')) {
        return {
          identifier: entityName,
          count: 1,
          chunks: [calleeChunkMergeEnv],
        };
      }
      return { identifier: entityName, count: 0, chunks: [] };
    });

    indexRepositorySpy = vi.spyOn(apiClient, 'indexRepository').mockImplementation(async (path: string) => {
      return {
        status: 'indexed',
        repo_path: path,
        indexed_files: 20,
        extracted_chunks: 350,
        elapsed_seconds: 1.25,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Journey 1 (R1): In-File Code Search & Highlighting in CodeViewer
  // =========================================================================
  describe('Journey 1 (R1): In-File Code Search & Highlighting in CodeViewer', () => {
    it('searches within code chunk, highlights with tag-safe <mark>, and displays match count pill', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Open ConnectRepoModal and select requests repo to load code chunks
      const connectRepoBtn = screen.getByTestId('connect-repo-btn');
      await user.click(connectRepoBtn);

      const openRequestsBtn = await screen.findByTestId('open-repo-btn-requests');
      await user.click(openRequestsBtn);

      // Verify CodeViewerHeader is rendered with first chunk
      const header = await screen.findByTestId('code-viewer-header');
      expect(header).toBeInTheDocument();

      // Open code search input
      const openSearchBtn = screen.getByTestId('open-code-search-btn');
      await user.click(openSearchBtn);

      const searchInput = screen.getByTestId('code-search-input');
      expect(searchInput).toBeInTheDocument();

      // Type search term "request" (occurs in "request" param and "PreparedRequest" and "prep = request")
      await user.type(searchInput, 'request');

      // Verify match count pill shows in header
      const matchCountPill = await screen.findByTestId('search-match-count');
      expect(matchCountPill).toBeInTheDocument();
      expect(matchCountPill.textContent).toMatch(/\d+ matches/);

      // Verify safe <mark> tags inside CodeDisplay without corrupting syntax highlighting
      const codeDisplay = screen.getByTestId('code-display');
      const marks = codeDisplay.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
      marks.forEach((m) => {
        expect(m.textContent?.toLowerCase()).toBe('request');
        expect(m.className).toContain('bg-amber-400/30');
      });

      // Clear search via clear button
      const clearSearchBtn = screen.getByTestId('clear-code-search-btn');
      await user.click(clearSearchBtn);

      // Verify match count pill disappears and marks are removed
      expect(screen.queryByTestId('search-match-count')).not.toBeInTheDocument();
      expect(codeDisplay.querySelectorAll('mark').length).toBe(0);
    });

    it('safely handles regex special characters without corrupting DOM', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('open-repo-btn-requests'));

      await user.click(await screen.findByTestId('open-code-search-btn'));
      const searchInput = screen.getByTestId('code-search-input');

      // Search for "(" which has special regex meaning
      await user.type(searchInput, '(');

      const matchPill = await screen.findByTestId('search-match-count');
      expect(matchPill).toBeInTheDocument();
      expect(matchPill.textContent).toMatch(/\d+ match/);

      const marks = screen.getByTestId('code-display').querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
      marks.forEach((m) => {
        expect(m.textContent).toBe('(');
      });
    });
  });

  // =========================================================================
  // Journey 2 (R2): ReAct Agent Search Query Scoping by Active Repository
  // =========================================================================
  describe('Journey 2 (R2): ReAct Agent Search Query Scoping by Active Repository', () => {
    it('executes search without filePath options when no repository is active', async () => {
      const user = userEvent.setup();
      render(<App />);

      const chatInput = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');

      // 1. Initial state: No repo connected -> search options must NOT contain a filePath
      await user.type(chatInput, 'Explain Python generators');
      await user.click(sendBtn);

      await waitFor(() => {
        expect(searchAstChunksSpy).toHaveBeenCalled();
      });

      const initialCallArgs = searchAstChunksSpy.mock.calls[0];
      const initialOptions = initialCallArgs[1];
      expect(initialOptions?.filePath).toBeUndefined();
    });

    it('scopes ReAct search queries to activeRepoPath when psf/requests is selected', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Connect psf/requests repository
      await user.click(screen.getByTestId('connect-repo-btn'));
      const openRequestsBtn = await screen.findByTestId('open-repo-btn-requests');
      await user.click(openRequestsBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('connect-repo-modal')).not.toBeInTheDocument();
        expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('psf/requests');
      });

      searchAstChunksSpy.mockClear();

      // Submit new query while requests is active
      const chatInput = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');
      await user.type(chatInput, 'Where is Session.send?');
      await user.click(sendBtn);

      await waitFor(() => {
        expect(searchAstChunksSpy).toHaveBeenCalled();
      });

      // Verify search was scoped to requests path
      const scopedCallArgs = searchAstChunksSpy.mock.calls[0];
      expect(scopedCallArgs[1]?.filePath).toBe('fixtures/requests');
    });

    it('dynamically switches search scoping to backend/sample_codebase on repo switch', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Connect sample_codebase repository
      await user.click(screen.getByTestId('connect-repo-btn'));
      const openSampleBtn = await screen.findByTestId('open-repo-btn-sample_codebase');
      await user.click(openSampleBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('connect-repo-modal')).not.toBeInTheDocument();
        expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('sample_codebase');
      });

      searchAstChunksSpy.mockClear();

      // Submit new query while sample_codebase is active
      const chatInput = screen.getByTestId('chat-input-textarea');
      const sendBtn = screen.getByTestId('chat-send-btn');
      await user.type(chatInput, 'Find Calculator methods');
      await user.click(sendBtn);

      await waitFor(() => {
        expect(searchAstChunksSpy).toHaveBeenCalled();
      });

      const sampleCallArgs = searchAstChunksSpy.mock.calls[0];
      expect(sampleCallArgs[1]?.filePath).toBe('backend/sample_codebase');
    });
  });

  // =========================================================================
  // Journey 3 (R3): Dynamic Query Suggestion Chips Based on Active Repository
  // =========================================================================
  describe('Journey 3 (R3): Dynamic Query Suggestion Chips Based on Active Repository', () => {
    it('renders default suggestions initially, and clicking a chip submits query and transitions agent', async () => {
      const user = userEvent.setup();
      render(<App />);

      const suggestionsContainer = screen.getByTestId('query-suggestions');
      expect(suggestionsContainer).toBeInTheDocument();

      // Initial state: default suggestions
      const defaultChips = screen.getAllByTestId('query-suggestion-chip');
      expect(defaultChips.length).toBeGreaterThan(0);
      expect(defaultChips[0].textContent).toContain('FastAPI');

      // Click a default suggestion chip and verify query submission
      const suggestionText = defaultChips[0].textContent!;
      await user.click(defaultChips[0]);

      // Verify user message appears in chat messages list and agent transitions to busy state
      await waitFor(() => {
        expect(screen.getByTestId('agentic-state-label')).not.toHaveTextContent('Idle');
      });

      // While agent is busy, suggestion chips become disabled
      const chips = screen.getAllByTestId('query-suggestion-chip');
      chips.forEach((c) => {
        expect(c).toBeDisabled();
      });
    });

    it('dynamically adapts suggestions when switching between repositories', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Select 'requests' repository
      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('open-repo-btn-requests'));

      // Suggestions should now be Requests-specific
      await waitFor(() => {
        const reqChips = screen.getAllByTestId('query-suggestion-chip');
        expect(reqChips[0].textContent).toBe('Where is Session.send defined?');
      });

      // Switch to 'sample_codebase' repository
      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('open-repo-btn-sample_codebase'));

      // Suggestions should now be sample_codebase specific
      await waitFor(() => {
        const sampleChips = screen.getAllByTestId('query-suggestion-chip');
        expect(sampleChips[0].textContent).toBe('Show Calculator class and methods');
      });
    });
  });

  // =========================================================================
  // Journey 4 (R4): Interactive AST Call Graph & Multi-Hop Navigation
  // =========================================================================
  describe('Journey 4 (R4): Interactive AST Call Graph & Multi-Hop Navigation', () => {
    it('renders call badges and import tags in ASTMetadataInspector, switching tab for local callee and invoking lookupEntity for external callee', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Load requests repository (contains chunk-req-send and chunk-req-build-resp)
      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('open-repo-btn-requests'));

      // Open AST metadata inspector
      const toggleInspectorBtn = await screen.findByTestId('toggle-ast-inspector-btn');
      await user.click(toggleInspectorBtn);

      const inspector = await screen.findByTestId('ast-metadata-inspector');
      expect(inspector).toBeInTheDocument();

      // Verify imports section renders
      const importsSection = screen.getByTestId('ast-imports-section');
      expect(importsSection).toBeInTheDocument();
      expect(screen.getByTestId('import-badge-urllib3')).toBeInTheDocument();
      expect(screen.getByTestId('import-badge-warnings')).toBeInTheDocument();

      // Verify called functions badges render with "↗"
      const callsSection = screen.getByTestId('ast-calls-section');
      expect(callsSection).toBeInTheDocument();

      const buildRespBadge = screen.getByTestId('call-badge-self.build_response');
      expect(buildRespBadge).toBeInTheDocument();
      expect(buildRespBadge.textContent).toContain('self.build_response ↗');

      const mergeEnvBadge = screen.getByTestId('call-badge-merge_environment_settings');
      expect(mergeEnvBadge).toBeInTheDocument();
      expect(mergeEnvBadge.textContent).toContain('merge_environment_settings ↗');

      // Interaction 1: Click local callee `self.build_response` (already loaded in activeChunks)
      await user.click(buildRespBadge);

      // Verify tab switched to build_response without calling lookupEntity
      await waitFor(() => {
        const activeTab = screen.getByTestId('chunk-tab-chunk-req-build-resp');
        expect(activeTab).toBeInTheDocument();
      });
      expect(lookupEntitySpy).not.toHaveBeenCalled();

      // Switch back to Session.send tab
      const sendTab = screen.getByTestId('chunk-tab-chunk-req-send');
      await user.click(sendTab);

      // Interaction 2: Click external callee `merge_environment_settings` (NOT currently in activeChunks)
      // Open inspector again for Session.send if not currently open
      if (!screen.queryByTestId('ast-metadata-inspector')) {
        await user.click(screen.getByTestId('toggle-ast-inspector-btn'));
      }

      const externalBadge = await screen.findByTestId('call-badge-merge_environment_settings');
      await user.click(externalBadge);

      // Verify apiClient.lookupEntity was invoked with clean entity name
      await waitFor(() => {
        expect(lookupEntitySpy).toHaveBeenCalledWith('merge_environment_settings');
      });

      // Verify new tab is added to active chunks tabs and selected
      await waitFor(() => {
        const newTab = screen.getByTestId('chunk-tab-chunk-req-merge-env');
        expect(newTab).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Journey 5 (R5): Live Backend Health & LanceDB Status Indicator
  // =========================================================================
  describe('Journey 5 (R5): Live Backend Health & LanceDB Status Indicator', () => {
    it('displays online health pill with LanceDB count, updates on repo switch, and falls back to offline simulator mode', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Verify initial live health pill shows online status and LanceDB count
      const pill = await screen.findByTestId('backend-health-pill');
      const label = screen.getByTestId('backend-health-label');
      const dot = screen.getByTestId('backend-health-dot');

      expect(pill).toBeInTheDocument();
      expect(label).toHaveTextContent('API:8000 (LanceDB: 284)');
      expect(dot).toHaveClass('bg-emerald-400');

      // Switching repository triggers health re-query
      getHealthSpy.mockClear();
      getHealthSpy.mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 298,
        embedding_dimension: 384,
      });

      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('open-repo-btn-requests'));

      await waitFor(() => {
        expect(getHealthSpy).toHaveBeenCalled();
        expect(label).toHaveTextContent('API:8000 (LanceDB: 298)');
      });

      // Indexing a new repo triggers health refresh
      getHealthSpy.mockClear();
      getHealthSpy.mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 350,
        embedding_dimension: 384,
      });

      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(screen.getByTestId('tab-add-repo'));

      const pathInput = screen.getByTestId('repo-path-input');
      const triggerIndexBtn = screen.getByTestId('trigger-index-btn');

      await user.type(pathInput, 'fixtures/requests');
      await user.click(triggerIndexBtn);

      await waitFor(() => {
        expect(indexRepositorySpy).toHaveBeenCalled();
        expect(getHealthSpy).toHaveBeenCalled();
      });

      // Offline fallback: when backend is unreachable, display offline status
      getHealthSpy.mockRejectedValueOnce(new Error('Connection refused'));

      // Trigger re-check by opening modal and switching repo
      await user.click(screen.getByTestId('connect-repo-btn'));
      await user.click(await screen.findByTestId('tab-existing-repos'));
      await user.click(await screen.findByTestId('open-repo-btn-sample_codebase'));

      await waitFor(() => {
        expect(label).toHaveTextContent('API: Offline (Simulator)');
        expect(dot).toHaveClass('bg-amber-400');
      });
    });
  });
});
