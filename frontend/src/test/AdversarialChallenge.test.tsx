import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import App from '../App';
import { CodeDisplay } from '../components/viewer/CodeDisplay';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { ChunkSelectorTabs } from '../components/viewer/ChunkSelectorTabs';
import { CodeViewerHeader } from '../components/viewer/CodeViewerHeader';
import { ASTMetadataInspector } from '../components/viewer/ASTMetadataInspector';
import { AstCodeChunk } from '../types';
import { mockAstChunks } from './fixtures/mockData';

describe('Adversarial Challenge 2: Python Highlighting, Line Numbers & DOM Accessibility', () => {
  // =========================================================================
  // SUITE 1: Mandatory data-testid DOM Accessibility Checks
  // =========================================================================
  describe('1. Mandatory DOM test-id & Accessibility Validation', () => {
    it('verifies all mandatory data-testid attributes are present in the DOM tree', () => {
      render(<App />);

      // The 6 mandatory test IDs specified in DISPATCH.md
      const splitPaneLayout = screen.getByTestId('split-pane-layout');
      const chatPane = screen.getByTestId('chat-pane');
      const codeViewerPane = screen.getByTestId('code-viewer-pane');
      const agenticLoopBanner = screen.getByTestId('agentic-loop-banner');
      const agenticStateLabel = screen.getByTestId('agentic-state-label');
      const codeDisplay = screen.getByTestId('code-display');

      expect(splitPaneLayout).toBeInTheDocument();
      expect(chatPane).toBeInTheDocument();
      expect(codeViewerPane).toBeInTheDocument();
      expect(agenticLoopBanner).toBeInTheDocument();
      expect(agenticStateLabel).toBeInTheDocument();
      expect(codeDisplay).toBeInTheDocument();

      // Additional structural test IDs
      expect(screen.getByTestId('code-viewer-header')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('chat-send-btn')).toBeInTheDocument();
    });

    it('ensures split-pane layout contains resizable gutter and proper flex container hierarchy', () => {
      const { container } = render(<App />);
      const layout = screen.getByTestId('split-pane-layout');
      expect(layout).toHaveClass('flex');

      const chat = screen.getByTestId('chat-pane');
      const viewer = screen.getByTestId('code-viewer-pane');

      // Verify layout parenting
      expect(layout).toContainElement(chat);
      expect(layout).toContainElement(viewer);

      // Verify resizer gutter exists between chat and viewer
      const gutter = container.querySelector('div[title="Drag to resize panes"]');
      expect(gutter).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 2: Python Syntax Highlighting Output & Prism Token Generation
  // =========================================================================
  describe('2. Python Syntax Highlighting Output & Token Verification', () => {
    const complexPythonChunk: AstCodeChunk = {
      id: 'chunk-complex-py',
      filePath: 'src/api/router.py',
      fileName: 'router.py',
      astNodeType: 'FunctionDef',
      identifier: 'handle_request',
      startLine: 1,
      endLine: 18,
      code: `@app.get("/items/{item_id}", response_model=ItemResponse)
async def handle_request(item_id: int, q: str | None = None) -> dict:
    """Retrieve an item by its unique identifier.
    Supports optional query filters.
    """
    # Check cache first
    cached_val = await cache.get(f"item:{item_id}")
    if cached_val is not None:
        return {"data": cached_val, "cached": True}

    try:
        raw_data = await db.fetch_item(item_id)
        if not raw_data:
            raise HTTPException(status_code=404, detail="Not found")
        return {"data": raw_data, "cached": False}
    except Exception as exc:
        logger.error(f"Error fetching {item_id}: {exc}")
        raise exc`,
      relevanceScore: 0.99,
      parameters: ['item_id: int', 'q: str | None = None'],
      decorators: ['@app.get("/items/{item_id}", response_model=ItemResponse)'],
    };

    it('generates real Prism token elements for Python keywords', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      // Check keyword tokens
      const keywordTokens = display.querySelectorAll('.token.keyword');
      expect(keywordTokens.length).toBeGreaterThanOrEqual(8);

      const keywordTexts = Array.from(keywordTokens).map((el) => el.textContent?.trim());
      expect(keywordTexts).toContain('async');
      expect(keywordTexts).toContain('def');
      expect(keywordTexts).toContain('if');
      expect(keywordTexts).toContain('return');
      expect(keywordTexts).toContain('try');
      expect(keywordTexts).toContain('raise');
      expect(keywordTexts).toContain('except');
    });

    it('generates real Prism token elements for Python functions', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      const functionTokens = display.querySelectorAll('.token.function');
      expect(functionTokens.length).toBeGreaterThan(0);

      const functionNames = Array.from(functionTokens).map((el) => el.textContent?.trim());
      expect(functionNames).toContain('handle_request');
    });

    it('generates real Prism token elements for Python strings (including multiline docstrings)', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      const stringTokens = display.querySelectorAll('.token.string');
      expect(stringTokens.length).toBeGreaterThan(0);

      // Check presence of string content
      const stringCombined = Array.from(stringTokens).map((el) => el.textContent).join(' ');
      expect(stringCombined).toContain('Retrieve an item by its unique identifier');
      expect(stringCombined).toContain('/items/{item_id}');
    });

    it('generates real Prism token elements for Python comments', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      const commentTokens = display.querySelectorAll('.token.comment');
      expect(commentTokens.length).toBeGreaterThanOrEqual(1);
      expect(commentTokens[0].textContent).toContain('# Check cache first');
    });

    it('generates real Prism token elements for Python booleans and numbers', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      const booleanTokens = display.querySelectorAll('.token.boolean');
      expect(booleanTokens.length).toBeGreaterThanOrEqual(2);
      const booleans = Array.from(booleanTokens).map((el) => el.textContent?.trim());
      expect(booleans).toContain('True');
      expect(booleans).toContain('False');

      const numberTokens = display.querySelectorAll('.token.number');
      expect(numberTokens.length).toBeGreaterThanOrEqual(1);
      const numbers = Array.from(numberTokens).map((el) => el.textContent?.trim());
      expect(numbers).toContain('404');
    });

    it('generates real Prism token elements for decorators', () => {
      render(<CodeDisplay chunk={complexPythonChunk} />);
      const display = screen.getByTestId('code-display');

      // Prism identifies decorators either as .token.decorator or punctuation + function
      const html = display.innerHTML;
      expect(html).toMatch(/token (decorator|operator|punctuation)/);
      expect(html).toContain('@app');
    });

    it('safely escapes HTML characters and does NOT render raw unescaped script tags', () => {
      const hostileChunk: AstCodeChunk = {
        id: 'chunk-hostile',
        filePath: 'test/hostile.py',
        fileName: 'hostile.py',
        astNodeType: 'Assign',
        identifier: 'xss_payload',
        startLine: 1,
        endLine: 2,
        code: `html_snippet = "<script>alert('xss')</script>"\nis_less = 5 < 10 and 20 > 15`,
        relevanceScore: 0.5,
      };

      const { container } = render(<CodeDisplay chunk={hostileChunk} />);

      // Ensure no raw script element was injected into the DOM
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);

      // Verify that < and > are rendered properly as text content
      const display = screen.getByTestId('code-display');
      expect(display.textContent).toContain("<script>alert('xss')</script>");
      expect(display.textContent).toContain('5 < 10 and 20 > 15');
    });
  });

  // =========================================================================
  // SUITE 3: Line Numbering Precision and Boundary Checks
  // =========================================================================
  describe('3. Line Numbering Precision & Gutter Alignment', () => {
    it('starts precisely from startLine with zero offset', () => {
      const chunkWithStart100: AstCodeChunk = {
        id: 'chunk-lines',
        filePath: 'test/lines.py',
        fileName: 'lines.py',
        astNodeType: 'FunctionDef',
        identifier: 'calc',
        startLine: 100,
        endLine: 104,
        code: `line1\nline2\nline3\nline4\nline5`,
        relevanceScore: 0.8,
      };

      render(<CodeDisplay chunk={chunkWithStart100} />);

      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(5);

      // Verify exact progression from startLine
      expect(lineNumbers[0].textContent).toBe('100');
      expect(lineNumbers[1].textContent).toBe('101');
      expect(lineNumbers[2].textContent).toBe('102');
      expect(lineNumbers[3].textContent).toBe('103');
      expect(lineNumbers[4].textContent).toBe('104');
    });

    it('correctly handles startLine = 1 boundary', () => {
      const chunkStart1: AstCodeChunk = {
        id: 'chunk-start-1',
        filePath: 'test/root.py',
        fileName: 'root.py',
        astNodeType: 'Module',
        identifier: 'root',
        startLine: 1,
        endLine: 3,
        code: `import os\nimport sys\nimport math`,
        relevanceScore: 0.7,
      };

      render(<CodeDisplay chunk={chunkStart1} />);

      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(3);
      expect(lineNumbers[0].textContent).toBe('1');
      expect(lineNumbers[1].textContent).toBe('2');
      expect(lineNumbers[2].textContent).toBe('3');
    });

    it('correctly handles single line code chunk', () => {
      const singleLineChunk: AstCodeChunk = {
        id: 'chunk-single',
        filePath: 'test/const.py',
        fileName: 'const.py',
        astNodeType: 'Assign',
        identifier: 'MAX_RETRIES',
        startLine: 42,
        endLine: 42,
        code: `MAX_RETRIES: int = 5`,
        relevanceScore: 0.9,
      };

      render(<CodeDisplay chunk={singleLineChunk} />);

      const lineNumbers = screen.getAllByTestId('line-number');
      expect(lineNumbers.length).toBe(1);
      expect(lineNumbers[0].textContent).toBe('42');
    });

    it('gracefully handles null chunk by rendering empty state without crash', () => {
      render(<CodeDisplay chunk={null} />);

      const display = screen.getByTestId('code-display');
      expect(display).toBeInTheDocument();
      expect(display.textContent).toContain('No AST code chunk selected');

      // No line numbers rendered
      expect(screen.queryByTestId('line-number')).not.toBeInTheDocument();
      expect(screen.queryByTestId('code-line-numbers')).not.toBeInTheDocument();
    });

    it('aligns line number gutter container with code display', () => {
      render(<CodeDisplay chunk={mockAstChunks[0]} />);

      const gutter = screen.getByTestId('code-line-numbers');
      expect(gutter).toBeInTheDocument();
      expect(gutter).toHaveClass('sticky');

      const lines = screen.getAllByTestId('line-number');
      // All lines should have consistent line height class
      lines.forEach((line) => {
        expect(line).toHaveClass('h-6');
      });
    });
  });

  // =========================================================================
  // SUITE 4: Tab Switching, AST Code, Metadata & Active Tab Styling Sync
  // =========================================================================
  describe('4. Tab Switching & AST State Consistency', () => {
    // Harness component to manage selection state dynamically
    const InteractiveViewerHarness: React.FC = () => {
      const [selectedId, setSelectedId] = useState<string>(mockAstChunks[0].id);

      return (
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={selectedId}
          onSelectChunk={setSelectedId}
        />
      );
    };

    it('properly switches active tab styling and updates displayed AST code and line numbers', async () => {
      const user = userEvent.setup();
      render(<InteractiveViewerHarness />);

      const tab1 = screen.getByTestId(`chunk-tab-${mockAstChunks[0].id}`);
      const tab2 = screen.getByTestId(`chunk-tab-${mockAstChunks[1].id}`);

      // Initial state: Tab 1 active
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab1).toHaveClass('font-semibold');

      // Initial header verification
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent(mockAstChunks[0].filePath);
      expect(screen.getByTestId('chunk-node-type')).toHaveTextContent(mockAstChunks[0].astNodeType);
      expect(screen.getByTestId('chunk-line-range')).toHaveTextContent(
        `Lines ${mockAstChunks[0].startLine}–${mockAstChunks[0].endLine}`
      );

      // Initial code display
      expect(screen.getByTestId('code-display').textContent).toContain('def verify_jwt_token');
      expect(screen.getAllByTestId('line-number')[0].textContent).toBe(
        String(mockAstChunks[0].startLine)
      );

      // CLICK TAB 2
      await user.click(tab2);

      // Tab styling switches
      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveClass('font-semibold');

      // Header updates to Chunk 2
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent(mockAstChunks[1].filePath);
      expect(screen.getByTestId('chunk-node-type')).toHaveTextContent(mockAstChunks[1].astNodeType);
      expect(screen.getByTestId('chunk-line-range')).toHaveTextContent(
        `Lines ${mockAstChunks[1].startLine}–${mockAstChunks[1].endLine}`
      );

      // Code display updates to Chunk 2
      expect(screen.getByTestId('code-display').textContent).toContain('class AsyncDatabasePool');
      expect(screen.getAllByTestId('line-number')[0].textContent).toBe(
        String(mockAstChunks[1].startLine) // 110
      );

      // CLICK TAB 1 AGAIN
      await user.click(tab1);

      // Restored back to Chunk 1
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent(mockAstChunks[0].filePath);
      expect(screen.getByTestId('code-display').textContent).toContain('def verify_jwt_token');
      expect(screen.getAllByTestId('line-number')[0].textContent).toBe(
        String(mockAstChunks[0].startLine)
      );
    });

    it('synchronizes AST Metadata Inspector with the selected tab when opened', async () => {
      const user = userEvent.setup();
      render(<InteractiveViewerHarness />);

      // Open AST metadata inspector
      const toggleBtn = screen.getByTestId('toggle-ast-inspector-btn');
      await user.click(toggleBtn);

      const inspector = screen.getByTestId('ast-metadata-inspector');
      expect(inspector).toBeInTheDocument();

      // Chunk 1 metadata
      expect(inspector.textContent).toContain('verify_jwt_token');
      expect(inspector.textContent).toContain('token: str');
      expect(inspector.textContent).toContain('secret_key: str');
      expect(inspector.textContent).toContain('@rate_limit(max_requests=100)');

      // Switch to Chunk 2 with inspector open
      const tab2 = screen.getByTestId(`chunk-tab-${mockAstChunks[1].id}`);
      await user.click(tab2);

      // Inspector now reflects Chunk 2 metadata
      expect(inspector.textContent).toContain('AsyncDatabasePool');
      expect(inspector.textContent).toContain('@singleton');
      expect(inspector.textContent).not.toContain('verify_jwt_token');
    });

    it('handles empty chunks array in ChunkSelectorTabs gracefully', () => {
      render(
        <ChunkSelectorTabs
          chunks={[]}
          selectedChunkId={null}
          onSelectChunk={() => {}}
        />
      );

      expect(screen.getByTestId('chunk-tabs-empty')).toBeInTheDocument();
      expect(screen.getByText('No AST code chunks retrieved yet.')).toBeInTheDocument();
    });

    it('defaults selectedChunk to chunks[0] when selectedChunkId is null or invalid', () => {
      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={'non-existent-id'}
          onSelectChunk={() => {}}
        />
      );

      // Falls back to chunk 0
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent(mockAstChunks[0].filePath);
      expect(screen.getByTestId('code-display').textContent).toContain('def verify_jwt_token');
    });

    it('switches tabs and updates code viewer when clicking tabs in full App', async () => {
      const user = userEvent.setup();
      render(<App />);

      // In full App, initial active chunks come from services/mockAstData
      // Chunk 0: chunk-fastapi-solve-deps
      // Chunk 1: chunk-fastapi-ws-endpoint
      const tab1 = screen.getByTestId('chunk-tab-chunk-fastapi-solve-deps');
      const tab2 = screen.getByTestId('chunk-tab-chunk-fastapi-ws-endpoint');

      // Initial tab 1 is active
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('fastapi/dependencies/utils.py');
      expect(screen.getByTestId('code-display').textContent).toContain('async def solve_dependencies');

      // Click tab 2
      await user.click(tab2);

      // Tab 2 active and code viewer updated
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('fastapi/websockets.py');
      expect(screen.getByTestId('code-display').textContent).toContain('class WebSocketEndpoint');
      expect(screen.getAllByTestId('line-number')[0].textContent).toBe('25'); // startLine 25
    });

    it('switches code viewer chunk when clicking an AST citation badge in chat message list in full App', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Initial welcome message cites chunk-fastapi-solve-deps
      const citationBtn = screen.getByTestId('chunk-citation-chunk-fastapi-solve-deps');
      expect(citationBtn).toBeInTheDocument();

      // First click tab 2 to change selection
      const tab2 = screen.getByTestId('chunk-tab-chunk-fastapi-ws-endpoint');
      await user.click(tab2);
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('fastapi/websockets.py');

      // Now click citation button for chunk-fastapi-solve-deps
      await user.click(citationBtn);

      // Code viewer should switch back to chunk-fastapi-solve-deps
      const tab1 = screen.getByTestId('chunk-tab-chunk-fastapi-solve-deps');
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('chunk-file-path')).toHaveTextContent('fastapi/dependencies/utils.py');
      expect(screen.getByTestId('code-display').textContent).toContain('async def solve_dependencies');
    });
  });
});
