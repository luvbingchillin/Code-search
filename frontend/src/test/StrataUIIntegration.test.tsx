import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeViewerContainer } from '../components/viewer/CodeViewerContainer';
import { CodeViewerHeader } from '../components/viewer/CodeViewerHeader';
import { mockAstChunks } from './fixtures/mockData';
import { apiClient } from '../services/apiClient';

describe('3D Strata Code Dependency Model UI Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. CodeViewerHeader View Mode Toggle', () => {
    it('renders view mode toggle with Code View and 3D Strata Map buttons', () => {
      const handleToggle = vi.fn();
      render(
        <CodeViewerHeader
          chunk={mockAstChunks[0]}
          viewMode="code"
          onToggleViewMode={handleToggle}
        />
      );

      const toggle = screen.getByTestId('view-mode-toggle');
      expect(toggle).toBeInTheDocument();

      const codeBtn = screen.getByTestId('view-mode-code-btn');
      const strataBtn = screen.getByTestId('view-mode-strata-btn');

      expect(codeBtn).toBeInTheDocument();
      expect(strataBtn).toBeInTheDocument();
      expect(codeBtn).toHaveTextContent('Code View');
      expect(strataBtn).toHaveTextContent('3D Strata Map');
    });

    it('invokes onToggleViewMode when clicking toggle buttons', async () => {
      const user = userEvent.setup();
      const handleToggle = vi.fn();
      render(
        <CodeViewerHeader
          chunk={mockAstChunks[0]}
          viewMode="code"
          onToggleViewMode={handleToggle}
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(handleToggle).toHaveBeenCalledWith('strata');

      await user.click(screen.getByTestId('view-mode-code-btn'));
      expect(handleToggle).toHaveBeenCalledWith('code');
    });

    it('renders 3D Strata Architecture Map heading in header when viewMode is strata', () => {
      render(
        <CodeViewerHeader
          chunk={mockAstChunks[0]}
          viewMode="strata"
          onToggleViewMode={() => {}}
        />
      );

      const filePathEl = screen.getByTestId('chunk-file-path');
      expect(filePathEl).toHaveTextContent('3D Strata Architecture Map');
    });
  });

  describe('2. CodeViewerContainer View Switching & Rendering', () => {
    it('defaults to code view rendering CodeDisplay', () => {
      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
        />
      );

      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(screen.queryByTestId('strata-canvas')).not.toBeInTheDocument();
    });

    it('switches to 3D Strata view when clicking Strata Map toggle button', async () => {
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

      // Strata view elements are rendered
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.queryByTestId('code-display')).not.toBeInTheDocument();

      // Displays mandatory call references label
      const label = screen.getByTestId('strata-call-reference-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Static Lexical Call References (Tree-sitter AST)');
    });

    it('switches back to code view when clicking Code View toggle button', async () => {
      const user = userEvent.setup();
      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
        />
      );

      // Switch to strata
      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();

      // Switch back to code
      await user.click(screen.getByTestId('view-mode-code-btn'));
      expect(screen.getByTestId('code-display')).toBeInTheDocument();
    });
  });

  describe('3. Agent Citation Highlighting in Strata View', () => {
    it('illuminates cited nodes and dims unreferenced nodes in baseline moss', async () => {
      const user = userEvent.setup();
      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="requests"
          citedChunks={['requests:Session']} // ONLY Session is cited by AI agent
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();

      // In JSDOM test fallback:
      // Cited node: requests:Session
      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      expect(sessionNode).toBeInTheDocument();
      expect(sessionNode.className).toContain('text-[#68f12b]'); // Electric acid lime

      // Unreferenced node: requests:HTTPAdapter
      const adapterNode = screen.getByTestId('strata-node-requests:HTTPAdapter');
      expect(adapterNode).toBeInTheDocument();
      expect(adapterNode.className).toContain('text-[#162a1c]'); // Dim muted moss baseline
    });
  });

  describe('4. Node Inspector Popup & Bidirectional Navigation', () => {
    it('opens node inspector popup on click showing symbol details and callees', async () => {
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

      // Click on Session node
      const sessionNode = screen.getByTestId('strata-node-requests:Session');
      await user.click(sessionNode);

      expect(handleSelectChunk).toHaveBeenCalledWith('requests:Session');

      // Inspector popup appears
      const inspector = screen.getByTestId('strata-node-inspector');
      expect(inspector).toBeInTheDocument();
      expect(inspector).toHaveTextContent('Session');
      expect(inspector).toHaveTextContent('fixtures/requests/sessions.py');
      expect(inspector).toHaveTextContent('ClassDef');
      expect(inspector).toHaveTextContent('Call References');

      // Displays "Open in Code Viewer" action button
      const openBtn = screen.getByTestId('open-in-code-viewer-btn');
      expect(openBtn).toBeInTheDocument();
      expect(openBtn).toHaveTextContent('Open in Code Viewer');
    });

    it('clicking "Open in Code Viewer" switches back to Code View and selects the chunk', async () => {
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

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      await user.click(screen.getByTestId('strata-node-requests:Session'));

      const openBtn = screen.getByTestId('open-in-code-viewer-btn');
      await user.click(openBtn);

      // Successfully switched back to Code View!
      expect(screen.getByTestId('code-display')).toBeInTheDocument();
      expect(handleSelectChunk).toHaveBeenCalledWith('requests:Session');
    });

    it('closes node inspector popup when clicking close button', async () => {
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

  describe('5. API Resilience & Offline Mock Fallback', () => {
    it('falls back to mock strata graph without crashing if API rejects', async () => {
      const spy = vi.spyOn(apiClient, 'getRepoStrataGraph').mockRejectedValueOnce(new Error('Network offline'));
      const user = userEvent.setup();

      render(
        <CodeViewerContainer
          chunks={mockAstChunks}
          selectedChunkId={mockAstChunks[0].id}
          onSelectChunk={() => {}}
          activeRepoId="sample_codebase"
        />
      );

      await user.click(screen.getByTestId('view-mode-strata-btn'));
      expect(screen.getByTestId('strata-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('strata-call-reference-label')).toBeInTheDocument();

      spy.mockRestore();
    });
  });
});
