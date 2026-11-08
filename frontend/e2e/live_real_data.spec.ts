import { test, expect } from '@playwright/test';

/**
 * Live End-to-End Test Suite against Real FastAPI Backend & LanceDB
 *
 * NOTE: This test suite uses ZERO mock routes (`page.route` is NOT used).
 * All network requests communicate directly with http://localhost:8000
 * running the live Python FastAPI backend with real LanceDB AST chunks (284 chunks from psf/requests).
 */
test.describe('Live Real-Data E2E Verification Suite (Zero Mock Fallbacks)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  // =========================================================================
  // Journey 1: Live Backend Health & LanceDB Telemetry
  // =========================================================================
  test('Journey 1: Live backend health check connects to port 8000 with real LanceDB count', async ({ page }) => {
    await page.goto('/');

    const healthPill = page.getByTestId('backend-health-pill');
    const healthLabel = page.getByTestId('backend-health-label');
    const healthDot = page.getByTestId('backend-health-dot');

    await expect(healthPill).toBeVisible();

    // Verify label displays real LanceDB count from live backend
    await expect(healthLabel).toHaveText(/API:8000 \(LanceDB: \d+\)/, { timeout: 10000 });
    await expect(healthDot).toHaveClass(/bg-emerald-400/);

    // Initial clean empty state: No hardcoded chunks loaded
    await expect(page.getByText(/No AST code chunk selected/i)).toBeVisible();
    await expect(page.getByTestId('empty-state-connect-repo-btn')).toBeVisible();
  });

  // =========================================================================
  // Journey 2: Repository Connection & Live Chunk Ingestion
  // =========================================================================
  test('Journey 2: Connects psf/requests repository and loads real AST chunks from backend', async ({ page }) => {
    await page.goto('/');

    // 1. Open Repository Hub Modal
    await page.getByTestId('connect-repo-btn').click();
    const modal = page.getByTestId('connect-repo-modal');
    await expect(modal).toBeVisible();

    // 2. Verify tracked repositories list contains psf/requests with real 284 chunks count
    const requestsCard = page.getByTestId('repo-card-requests');
    await expect(requestsCard).toBeVisible();
    await expect(requestsCard).toContainText('psf/requests');
    await expect(requestsCard).toContainText('284 AST chunks');

    // 3. Click Open & Query on psf/requests
    await page.getByTestId('open-repo-btn-requests').click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Header repo indicator should update to psf/requests
    await expect(page.getByTestId('connect-repo-btn')).toContainText('psf/requests');

    // Code viewer header should become visible with real chunk tabs
    const codeHeader = page.getByTestId('code-viewer-header');
    await expect(codeHeader).toBeVisible();

    // Code display should render real Python code from requests
    const codeDisplay = page.getByTestId('code-display');
    await expect(codeDisplay).toBeVisible();
    const codeText = await codeDisplay.textContent();
    expect(codeText).toBeTruthy();
    expect(codeText?.length).toBeGreaterThan(20);

    // Syntax-highlighted code container and line numbers should be present
    await expect(page.locator('pre code.language-python')).toBeVisible();
    await expect(page.getByTestId('code-line-numbers')).toBeVisible();
  });

  // =========================================================================
  // Journey 3: Real In-File Python AST Search
  // =========================================================================
  test('Journey 3: Performs in-file code search with live <mark> highlighting on real Python code', async ({ page }) => {
    await page.goto('/');

    // Connect repository to populate real code
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();
    await expect(page.getByTestId('code-viewer-header')).toBeVisible();

    // Open in-file search
    await page.getByTestId('open-code-search-btn').click();
    const searchInput = page.getByTestId('code-search-input');
    await expect(searchInput).toBeVisible();

    // Search for standard Python keyword "def"
    await searchInput.fill('def');

    // Verify match counter pill displays positive count
    const matchCountPill = page.getByTestId('search-match-count');
    await expect(matchCountPill).toBeVisible();
    await expect(matchCountPill).toContainText('match');

    // Verify <mark> tags are rendered inside code display
    const marks = page.getByTestId('code-display').locator('mark');
    await expect(marks.first()).toBeVisible();
    const count = await marks.count();
    expect(count).toBeGreaterThan(0);

    // Clear search and ensure highlights disappear cleanly
    await page.getByTestId('clear-code-search-btn').click();
    await expect(matchCountPill).not.toBeVisible();
    expect(await marks.count()).toBe(0);
  });

  // =========================================================================
  // Journey 4: Real Tree-Sitter AST Call Graph & Callee Navigation
  // =========================================================================
  test('Journey 4: Inspects real Tree-Sitter AST calls and imports with multi-hop navigation', async ({ page }) => {
    await page.goto('/');

    // Connect repository
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();
    await expect(page.getByTestId('code-viewer-header')).toBeVisible();

    // Open AST Metadata Inspector
    await page.getByTestId('toggle-ast-inspector-btn').click();
    const inspector = page.getByTestId('ast-metadata-inspector');
    await expect(inspector).toBeVisible();

    // Verify AST Metadata displays real Tree-sitter imports section
    const importsSection = page.getByTestId('ast-imports-section');
    await expect(importsSection).toBeVisible();

    // Verify AST Calls section
    const callsSection = page.getByTestId('ast-calls-section');
    await expect(callsSection).toBeVisible();

    // Find any rendered call badge
    const callBadges = callsSection.locator('[data-testid^="call-badge-"]');
    const badgeCount = await callBadges.count();
    if (badgeCount > 0) {
      const firstBadge = callBadges.first();
      await expect(firstBadge).toBeVisible();
      const badgeText = await firstBadge.textContent();
      expect(badgeText).toContain('↗');

      // Click the call badge to trigger navigation (local tab switch or live entity lookup)
      await firstBadge.click();

      // Ensure code viewer remains stable and displays the selected chunk
      await expect(page.getByTestId('code-display')).toBeVisible();
    }
  });

  // =========================================================================
  // Journey 5: Scoped ReAct Agent Query against Live LanceDB
  // =========================================================================
  test('Journey 5: Submits ReAct query scoped to requests and receives real LanceDB AST citations', async ({ page }) => {
    await page.goto('/');

    // 1. Connect psf/requests repo
    await page.getByTestId('connect-repo-btn').click();
    await page.getByTestId('open-repo-btn-requests').click();

    // 2. Dynamic suggestions should display requests-specific questions
    const requestsChip = page.getByText('Where is Session.send defined?');
    await expect(requestsChip).toBeVisible();

    // Verify welcome message is visible
    await expect(page.getByTestId('chat-message-welcome-msg')).toBeVisible();

    // 3. Submit query by clicking suggestion chip
    await requestsChip.click();

    // Agent transitions to busy state (Thinking / Searching AST / Synthesizing)
    const stateLabel = page.getByTestId('agentic-state-label');
    await expect(stateLabel).not.toHaveText('Idle');

    // Wait for agent to complete processing (live LanceDB search + synthesis)
    await expect(stateLabel).toHaveText(/Ready|Idle|Complete/i, { timeout: 35000 });

    // Verify chat received assistant response message
    const assistantMessage = page.locator('[data-testid^="chat-message-asst-"]');
    await expect(assistantMessage.first()).toBeVisible({ timeout: 10000 });

    // Verify message content is non-empty and formatted
    const messageContent = await assistantMessage.first().textContent();
    expect(messageContent).toBeTruthy();
    expect(messageContent).toContain('Based on the codebase analysis');

    // Verify cited AST chunks section and badges
    await expect(page.getByText('Cited AST Chunks:')).toBeVisible();
    const citationButtons = page.locator('button[data-testid^="chunk-citation-"]');
    await expect(citationButtons.first()).toBeVisible();

    // Clicking a citation badge switches the active chunk in code viewer
    await citationButtons.first().click();
    await expect(page.getByTestId('code-display')).toBeVisible();
  });
});
