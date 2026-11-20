import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { CodeViewerHeader } from '../components/viewer/CodeViewerHeader';
import { StrataCanvas, isWebGLAvailable } from '../components/strata/StrataCanvas';
import { computeStrataLayout } from '../services/strata/strataLayout';
import { getMockStrataGraph } from '../services/mockStrataData';
import { mockAstChunks } from './fixtures/mockData';
import { apiClient } from '../services/apiClient';
import { AstCodeChunk } from '../types';

describe('3D Layered Strata Code Dependency Model Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. View Mode Toggling between Code View and 3D Strata View', () => {
    it('renders view mode toggle buttons with proper initial state in CodeViewerHeader', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(
        <CodeViewerHeader
          chunk={mockAstChunks[0]}
          viewMode="code"
          onToggleViewMode={onToggle}
        />
      );

      const codeBtn = screen.getByTestId('view-mode-code-btn');
      const strataBtn = screen.getByTestId('view-mode-strata-btn');

      expect(codeBtn).toBeInTheDocument();
      expect(strataBtn).toBeInTheDocument();
      expect(codeBtn).toHaveTextContent('Code View');
      expect(strataBtn).toHaveTextContent('3D Strata Map');

      await user.click(strataBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith('strata');
    });

    it('toggles seamlessly between CodeDisplay and 3D Strata Map in CodeViewerContainer', async () => {
      const user = userEvent.setup();
      const handleSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={handleSelectChunk}
          activeRepoId="requests"
        />
      );

      // Initially renders Code View
      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(screen.queryByTestId('strata-canvas')).not.toBeInTheDocument();

      // Switch to 3D Strata View
      await user.click(screen.getByTestId('view-mode-strata-btn'));

      // Strata canvas and call references label should be visible
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.queryByTestId('code-display')).not.toBeInTheDocument();

      const label = screen.getByTestId('strata-call-reference-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Static Lexical Call References (Tree-sitter AST)');

      // Switch back to Code View
      await user.click(screen.getByTestId('view-mode-code-btn'));

      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(screen.queryByTestId('strata-canvas')).not.toBeInTheDocument();
    });

    it('supports controlled viewMode prop passed from parent layout', () => {
      const { rerender } = render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          viewMode="code"
        />
      );

      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(screen.queryByTestId('strata-canvas')).not.toBeInTheDocument();

      rerender(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          viewMode="strata"
        />
      );

      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.queryByTestId('code-display')).not.toBeInTheDocument();
    });
  });

  describe('2. Highlighting of Cited Nodes when Agent Cites Chunks', () => {
    it('highlights cited nodes in electric acid lime and dims unreferenced nodes in baseline moss', async () => {
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="requests"
          citedChunks={['requests:Session']} // Only requests:Session is cited
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();

      // Cited node: requests:Session
      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      expect(sessionNode).toBeInTheDocument();
      expect(sessionNode.className).toContain('text-[#68f12b]');
      expect(sessionNode.className).toContain('border-[#68f12b]');

      // Unreferenced node: requests:HTTPAdapter
      const adapterNode = screen.getByTestId('strata-node-requests:HTTPAdapter');
      expect(adapterNode).toBeInTheDocument();
      expect(adapterNode.className).toContain('text-[#162a1c]');
      expect(adapterNode.className).toContain('border-[#162a1c]');
    });

    it('dynamically illuminates multiple cited nodes across different architectural tiers', async () => {
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="requests"
          citedChunks={['requests:Session', 'requests:HTTPAdapter', 'requests:Request', 'requests:get']}
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));

      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      const adapterNode = screen.getByTestId('strata-node-requests:HTTPAdapter');
      const requestNode = screen.getByTestId('strata-node-requests:Request');
      const getNode = screen.getByTestId('strata-node-requests:get');

      expect(sessionNode.className).toContain('text-[#68f12b]');
      expect(adapterNode.className).toContain('text-[#68f12b]');
      expect(requestNode.className).toContain('text-[#68f12b]');
      expect(getNode.className).toContain('text-[#68f12b]');
    });

    it('falls back to active chunks highlighting when no explicit agent citation is present', async () => {
      const user = userEvent.setup();
      const sessionChunk: AstCodeChunk = {
        id: 'requests:Session',
        identifier: 'Session',
        filePath: 'fixtures/requests/sessions.py',
        fileName: 'sessions.py',
        astNodeType: 'ClassDef',
        startLine: 320,
        endLine: 680,
        code: 'class Session:\n    pass',
        relevanceScore: 0.95,
      };

      render(
        <CodeViewerContainer
          chunks={[sessionChunk]}
          selectedChunkId={null}
          onSelectChunk={() => {}}
          activeRepoId="requests"
          citedChunks={[]}
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));

      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      expect(sessionNode).toBeInTheDocument();
      // Since Session is in chunks array and no citedChunks provided, it gets highlighted
      expect(sessionNode.className).toContain('text-[#68f12b]');
    });
  });

  describe('3. Fallback Rendering in JSDOM Environment without WebGL Errors', () => {
    it('correctly detects JSDOM environment without crashing WebGL context', () => {
      expect(isWebGLAvailable()).toBe(false);
    });

    it('renders StrataCanvas gracefully in JSDOM environment with fallback DOM structure', () => {
      const graphData = computeStrataLayout(getMockStrataGraph('requests'));
      const onSelect = vi.fn();

      render(
        <StrataCanvas
          graphData={graphData}
          highlightedChunkIds={new Set(['requests:Session'])}
          selectedChunkId="requests:Session"
          onSelectNode={onSelect}
        />
      );

      // Fallback container is rendered
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.getByText('3D Strata Architecture Canvas (Headless Mode)')).toBeInTheDocument();
      expect(screen.getByText(/nodes · .* caller-callee edges · 4 layered tiers/)).toBeInTheDocument();

      // All 4 tiers are rendered
      expect(screen.getByText('Tier 0')).toBeInTheDocument();
      expect(screen.getByText('Tier 1')).toBeInTheDocument();
      expect(screen.getByText('Tier 2')).toBeInTheDocument();
      expect(screen.getByText('Tier 3')).toBeInTheDocument();

      // Node chips are clickable without WebGL context
      const sessionChip = screen.getByTestId('strata-node-requests:Session');
      expect(sessionChip).toBeInTheDocument();
      expect(sessionChip).toHaveTextContent('Session');
    });

    it('handles interactive node chip clicks in fallback mode', async () => {
      const user = userEvent.setup();
      const graphData = computeStrataLayout(getMockStrataGraph('requests'));
      const onSelect = vi.fn();

      render(
        <StrataCanvas
          graphData={graphData}
          highlightedChunkIds={new Set()}
          selectedChunkId={null}
          onSelectNode={onSelect}
        />
      );

      const adapterChip = screen.getByTestId('strata-node-requests:HTTPAdapter');
      await user.click(adapterChip);
      expect(onSelect).toHaveBeenCalledWith('requests:HTTPAdapter');
    });
  });

  describe('4. Clicking a Node in Strata View and Triggering "Open in Code Viewer"', () => {
    it('opens node inspector popup with symbol metadata and outgoing callee references', async () => {
      const user = userEvent.setup();
      const handleSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={null}
          onSelectChunk={handleSelectChunk}
          activeRepoId="requests"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));

      // Click on requests:Session
      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      await user.click(sessionNode);

      expect(handleSelectChunk).toHaveBeenCalledWith('requests:Session');

      // Inspector popup rendered
      const inspector = screen.getByTestId('strata-node-inspector');
      expect(inspector).toBeInTheDocument();
      expect(inspector).toHaveTextContent('Session');
      expect(inspector).toHaveTextContent('Tier 2: Core Logic');
      expect(inspector).toHaveTextContent('fixtures/requests/sessions.py');
      expect(inspector).toHaveTextContent('ClassDef');
      expect(inspector).toHaveTextContent('Call References');

      // Callee edge references visible (Session calls mount, prepare_request, resolve_redirects)
      expect(inspector).toHaveTextContent('mount');
      expect(inspector).toHaveTextContent('prepare_request');
      expect(inspector).toHaveTextContent('resolve_redirects');

      // 'Open in Code Viewer' action button visible
      const openBtn = screen.getByTestId('open-in-code-viewer-btn');
      expect(openBtn).toBeInTheDocument();
      expect(openBtn).toHaveTextContent('Open in Code Viewer');
    });

    it('transitions viewMode back to Code View and preserves chunk selection when clicking "Open in Code Viewer"', async () => {
      const user = userEvent.setup();
      const handleSelectChunk = vi.fn();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={handleSelectChunk}
          activeRepoId="requests"
        />
      );

      // Enter strata view
      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();

      // Click on a node
      await user.click(screen.getByTestId('strata-node-requests:Session'));
      expect(screen.getByTestId('strata-node-inspector')).toBeInTheDocument();

      // Click 'Open in Code Viewer'
      const openBtn = screen.getByTestId('open-in-code-viewer-btn');
      await user.click(openBtn);

      // View mode successfully switched back to code view
      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(screen.queryByTestId('strata-canvas')).not.toBeInTheDocument();
      expect(handleSelectChunk).toHaveBeenCalledWith('requests:Session');
    });

    it('hydrates chunk via onAddChunk if inspected node is not yet present in active chunks array', async () => {
      const user = userEvent.setup();
      const handleAddChunk = vi.fn();
      const mockFetchedChunk = {
        id: 'requests:HTTPAdapter',
        identifier: 'HTTPAdapter',
        filePath: 'requests/adapters.py',
        startLine: 1,
        endLine: 50,
        content: 'class HTTPAdapter:\n    pass\n',
        astNodeType: 'ClassDef',
      };

      const spy = vi.spyOn(apiClient, 'getChunkById').mockResolvedValueOnce(mockFetchedChunk as any);

      render(
        <CodeViewerContainer
          chunks={[mockAstChunks[0]]} // Only Session is in chunks
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          onAddChunk={handleAddChunk}
          activeRepoId="requests"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      await user.click(screen.getByTestId('strata-node-requests:HTTPAdapter'));

      const openBtn = screen.getByTestId('open-in-code-viewer-btn');
      await user.click(openBtn);

      await waitFor(() => {
        expect(handleAddChunk).toHaveBeenCalledWith(mockFetchedChunk);
      });

      spy.mockRestore();
    });

    it('closes the node inspector popup when clicking the close button', async () => {
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="requests"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      await user.click(screen.getByTestId('strata-node-requests:Session'));
      expect(screen.getByTestId('strata-node-inspector')).toBeInTheDocument();

      await user.click(screen.getByTestId('close-strata-inspector-btn'));
      expect(screen.queryByTestId('strata-node-inspector')).not.toBeInTheDocument();
    });
  });

  describe('5. Robustness & API Graph Synchronization', () => {
    it('fetches remote strata graph on mount and synchronizes nodes', async () => {
      const customGraph = {
        nodes: [
          {
            id: 'custom:node1',
            identifier: 'NodeOne',
            filePath: 'custom/node1.py',
            astNodeType: 'FunctionDef',
            tier: 2 as const,
            tierName: 'Core Logic',
            startLine: 1,
            endLine: 20,
          },
        ],
        edges: [],
        tiers: [
          { tier: 0, name: 'Foundation', color: '#3b82f6', nodeCount: 0 },
          { tier: 1, name: 'Adapters', color: '#10b981', nodeCount: 0 },
          { tier: 2, name: 'Core Logic', color: '#f59e0b', nodeCount: 1 },
          { tier: 3, name: 'Entrypoints', color: '#ef4444', nodeCount: 0 },
        ],
      };

      const spy = vi.spyOn(apiClient, 'getRepoStrataGraph').mockResolvedValueOnce(customGraph as any);
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="custom_repo"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('strata-node-custom:node1')).toBeInTheDocument();
      });

      spy.mockRestore();
    });

    it('falls back gracefully to mock strata data when API returns network error', async () => {
      const spy = vi.spyOn(apiClient, 'getRepoStrataGraph').mockRejectedValueOnce(new Error('Connection refused'));
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="offline_repo"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));

      // Does not crash, renders fallback mock data
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('strata-call-reference-label')).toBeInTheDocument();

      spy.mockRestore();
    });
  });
});
