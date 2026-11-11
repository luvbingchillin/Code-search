import { test, expect } from '@playwright/test';

test.describe('Sequential Improvements Automated Browser E2E Suite (Milestone 6)', () => {
  const mockHealthy = {
    status: 'healthy',
    vector_db: 'lancedb',
    total_chunks: 284,
    embedding_dimension: 384,
    embedding_model: 'all-MiniLM-L6-v2',
  };

  const mockRepos = [
    {
      id: 'requests',
      name: 'psf/requests',
      path: 'fixtures/requests',
      chunks_count: 284,
      files_count: 17,
      status: 'indexed',
      description: 'Python HTTP for Humans (284 AST nodes)',
    },
    {
      id: 'sample_codebase',
      name: 'sample_codebase',
      path: 'backend/sample_codebase',
      chunks_count: 14,
      files_count: 3,
      status: 'indexed',
      description: 'FastAPI service sample',
    },
  ];

  const mockRequestsChunks = [
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

  const mockSampleChunks = [
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

  const mockLookupChunk = {
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

  test.beforeEach(async ({ page }) => {
    // Intercept backend API routes
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHealthy),
      });
    });

    await page.route('**/api/v1/repos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ repositories: mockRepos, total: 2 }),
      });
    });

    await page.route('**/api/v1/repos/requests/chunks**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRequestsChunks),
      });
    });

    await page.route('**/api/v1/repos/sample_codebase/chunks**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSampleChunks),
      });
    });

    await page.route('**/api/v1/entity/*', async (route) => {
      const url = route.request().url();
      if (url.includes('merge_environment_settings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            identifier: 'merge_environment_settings',
            count: 1,
            chunks: [mockLookupChunk],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ identifier: 'unknown', count: 0, chunks: [] }),
        });
      }
    });

    await page.route('**/api/v1/index', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          indexed_files: 20,
          extracted_chunks: 350,
          elapsed_seconds: 1.15,
        }),
      });
    });
  });

  // =========================================================================
  // Feature 1 (R1): In-File Code Search & Highlighting in CodeViewer
  // =========================================================================
  test('Feature 1 (R1): In-file code search highlights terms with tag-safe <mark> and displays match count pill', async ({ page }) => {
    await page.goto('/');

    // Open ConnectRepoModal and connect psf/requests repo
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    // Verify CodeViewerHeader is displayed with loaded chunk
    const header = page.getByTestId('code-viewer-header');
    await expect(header).toBeVisible();

    // Open search input in header
    await page.getByTestId('open-code-search-btn').click();
    const searchInput = page.getByTestId('code-search-input');
    await expect(searchInput).toBeVisible();

    // Type search term "request"
    await searchInput.fill('request');

    // Verify match count pill appears with count (e.g. "3 matches" or "2 matches")
    const matchCountPill = page.getByTestId('search-match-count');
    await expect(matchCountPill).toBeVisible();
    await expect(matchCountPill).toContainText('match');

    // Verify highlighted <mark> elements inside code display
    const codeDisplay = page.getByTestId('code-display');
    const marks = codeDisplay.locator('mark');
    await expect(marks.first()).toBeVisible();
    expect(await marks.count()).toBeGreaterThan(0);

    // Clear search
    await page.getByTestId('clear-code-search-btn').click();
    await expect(page.getByTestId('search-match-count')).not.toBeVisible();
    expect(await marks.count()).toBe(0);
  });

  // =========================================================================
  // Feature 2 (R2): ReAct Agent Search Query Scoping by Active Repository
  // =========================================================================
  test('Feature 2 (R2): Scopes ReAct search queries to active repository path', async ({ page }) => {
    let capturedSearchPayload: any = null;
    await page.route('**/api/v1/search', async (route) => {
      capturedSearchPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: capturedSearchPayload?.query ?? '',
          total_results: 1,
          chunks: mockRequestsChunks,
          latency_ms: 15,
        }),
      });
    });

    await page.goto('/');

    // 1. Initial query without active repository -> Gated with friendly onboarding card (zero blind search)
    const chatInput = page.getByTestId('chat-input-textarea');
    await chatInput.fill('General question without repository');
    await page.getByTestId('chat-send-btn').click();

    const messageList = page.getByTestId('message-list');
    await expect(messageList).toContainText('No Active Repository Connected');
    expect(capturedSearchPayload).toBeNull();

    // 2. Connect psf/requests repo
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();
    await expect(page.getByTestId('connect-repo-btn')).toContainText('psf/requests');

    // Wait for agent to return to Idle if busy
    await expect(page.getByTestId('agentic-state-label')).toHaveText(/Ready|Idle|Complete/i);

    capturedSearchPayload = null;
    await chatInput.fill('Where is Session.send?');
    await page.getByTestId('chat-send-btn').click();

    // Verify search payload was scoped to fixtures/requests
    await expect(async () => {
      expect(capturedSearchPayload).not.toBeNull();
      expect(capturedSearchPayload.file_path).toBe('fixtures/requests');
    }).toPass();
  });

  // =========================================================================
  // Feature 3 (R3): Dynamic Query Suggestion Chips Based on Active Repository
  // =========================================================================
  test('Feature 3 (R3): Dynamic query suggestion chips adapt to active repository and submit query on click', async ({ page }) => {
    await page.goto('/');

    // Initial state: default suggestions
    const defaultChip = page.getByTestId('query-suggestion-chip').first();
    await expect(defaultChip).toBeVisible();
    await expect(defaultChip).toContainText('FastAPI');

    // Connect 'requests' repository
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    // Suggestion chips should update to Requests AST queries
    const requestsChip = page.getByText('Where is Session.send defined?');
    await expect(requestsChip).toBeVisible();

    // Connect 'sample_codebase' repository
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-sample_codebase').click();

    // Suggestion chips should update to sample codebase queries
    const sampleChip = page.getByText('Show Calculator class and methods');
    await expect(sampleChip).toBeVisible();

    // Clicking suggestion chip initiates agent query
    await sampleChip.click();
    await expect(page.getByTestId('agentic-state-label')).not.toHaveText('Idle');
  });

  // =========================================================================
  // Feature 4 (R4): Interactive AST Call Graph & Multi-Hop Navigation
  // =========================================================================
  test('Feature 4 (R4): Interactive AST metadata inspector displays calls and imports with interactive navigation', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    // Open AST Inspector
    await page.getByTestId('toggle-ast-inspector-btn').click();
    const inspector = page.getByTestId('ast-metadata-inspector');
    await expect(inspector).toBeVisible();

    // Verify imports and calls badges render
    await expect(page.getByTestId('ast-imports-section')).toBeVisible();
    await expect(page.getByTestId('import-badge-urllib3')).toBeVisible();

    await expect(page.getByTestId('ast-calls-section')).toBeVisible();
    const localCallBadge = page.getByTestId('call-badge-self.build_response');
    await expect(localCallBadge).toBeVisible();
    await expect(localCallBadge).toContainText('self.build_response ↗');

    // Click local callee badge -> switches directly to build_response tab
    await localCallBadge.click();
    await expect(page.getByTestId('chunk-tab-chunk-req-build-resp')).toBeVisible();

    // Switch back to Session.send tab
    await page.getByTestId('chunk-tab-chunk-req-send').click();

    // Open inspector if drawer closed
    if (!await inspector.isVisible()) {
      await page.getByTestId('toggle-ast-inspector-btn').click();
    }

    // Click external callee badge -> triggers lookupEntity and loads new tab
    const externalCallBadge = page.getByTestId('call-badge-merge_environment_settings');
    await expect(externalCallBadge).toBeVisible();
    await externalCallBadge.click();

    // Verify new chunk tab is loaded
    await expect(page.getByTestId('chunk-tab-chunk-req-merge-env')).toBeVisible();
  });

  // =========================================================================
  // Feature 5 (R5): Live Backend Health & LanceDB Status Indicator
  // =========================================================================
  test('Feature 5 (R5): Displays live backend health status and handles offline simulator fallback', async ({ page }) => {
    await page.goto('/');

    // 1. Initial healthy state: Displays API:8000 (LanceDB: 284)
    const pill = page.getByTestId('backend-health-pill');
    const label = page.getByTestId('backend-health-label');
    const dot = page.getByTestId('backend-health-dot');

    await expect(pill).toBeVisible();
    await expect(label).toHaveText('API:8000 (LanceDB: 284)');
    await expect(dot).toHaveClass(/bg-emerald-400/);

    // 2. Health refresh on repo switch
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockHealthy, total_chunks: 298 }),
      });
    });

    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();
    await expect(label).toHaveText('API:8000 (LanceDB: 298)');

    // 3. Offline simulator mode fallback when backend fails
    await page.route('**/api/v1/health', async (route) => {
      await route.abort('failed');
    });

    // Re-check triggered by switching repository
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-sample_codebase').click();

    await expect(label).toHaveText('API: Offline (Simulator)');
    await expect(dot).toHaveClass(/bg-amber-400/);
  });

  // =========================================================================
  // Feature 6: Slash Commands, Conversational Intent & Repository Gating
  // =========================================================================
  test('Feature 6: Gating on unselected repo, slash command popover, and instant /help & /status responses', async ({ page }) => {
    await page.goto('/');

    const chatInput = page.getByTestId('chat-input-textarea');
    await expect(chatInput).toHaveAttribute(
      'placeholder',
      'Connect a repository to search AST code, or type /help...'
    );

    // 1. Submit blind query before connecting a repo -> gated onboarding card
    await chatInput.fill('dd');
    await chatInput.press('Enter');

    const messageList = page.getByTestId('message-list');
    await expect(messageList).toContainText('No Active Repository Connected');
    await expect(messageList).toContainText('Please select or connect a Python repository');

    // 2. Type '/' -> shows command suggestions popover
    await chatInput.fill('/');
    const popover = page.getByTestId('slash-commands-popover');
    await expect(popover).toBeVisible();
    await expect(page.getByTestId('slash-cmd-help')).toBeVisible();
    await expect(page.getByTestId('slash-cmd-status')).toBeVisible();

    // 3. Click /status -> instant status card without vector search
    await page.getByTestId('slash-cmd-status').click();
    await expect(messageList).toContainText('System & Repository Status');
    await expect(messageList).toContainText('Active Repository');

    // 4. Conversational intent: "what repo am i in"
    await chatInput.fill('what repo am i in');
    await chatInput.press('Enter');
    await expect(messageList).toContainText('None connected');

    // 5. Connect psf/requests -> placeholder updates
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    await expect(chatInput).toHaveAttribute(
      'placeholder',
      'Ask a question about psf/requests (or type /help, /status)...'
    );

    // 6. Conversational intent: "what repo am i in" now returns psf/requests
    await chatInput.fill('what repo am i in');
    await chatInput.press('Enter');
    await expect(messageList).toContainText('psf/requests');
  });

  // =========================================================================
  // Feature 7: UX Edge Cases, New Chat Session & Zero-Result Guard
  // =========================================================================
  test('Feature 7: New Chat button resets chat history and zero-result search returns honest card', async ({ page }) => {
    await page.route('**/api/v1/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'unknown_symbol_xyz',
          total_results: 0,
          chunks: [],
          latency_ms: 10,
        }),
      });
    });

    await page.goto('/');

    const messageList = page.getByTestId('message-list');
    const chatInput = page.getByTestId('chat-input-textarea');

    // 1. Initial empty state has "No repository connected"
    const codeDisplay = page.getByTestId('code-display');
    await expect(codeDisplay).toContainText('No repository connected');
    await expect(page.getByTestId('empty-state-connect-repo-btn')).toBeVisible();

    // 2. Connect repository psf/requests
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    // Repository connection message appears in chat
    await expect(messageList).toContainText('Connected Repository: psf/requests');

    // 3. Test New Chat button clears history and reveals clean empty welcome state
    const clearChatBtn = page.getByTestId('clear-chat-btn');
    await expect(clearChatBtn).toBeVisible();
    await clearChatBtn.click();

    // Messages should be cleared and welcome card shown
    await expect(messageList).not.toContainText('Connected Repository: psf/requests');
    await expect(page.getByTestId('chat-empty-welcome')).toBeVisible();

    // 4. Test Close All tabs button
    const closeAllTabsBtn = page.getByTestId('close-all-tabs-btn');
    if (await closeAllTabsBtn.isVisible()) {
      await closeAllTabsBtn.click();
      await expect(codeDisplay).toContainText('No AST code tabs open');
    }

    // 5. Query for non-existent symbol -> Zero-result card, no hallucinated CaseInsensitiveDict
    await chatInput.fill('unknown_symbol_xyz');
    await chatInput.press('Enter');

    await expect(messageList).toContainText('No Matching AST Nodes Found');
    await expect(messageList).not.toContainText('CaseInsensitiveDict');
  });
});
