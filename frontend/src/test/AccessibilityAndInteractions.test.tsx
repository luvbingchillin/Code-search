import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectRepoModal } from '../components/repo/ConnectRepoModal';
import { RepoFileTree } from '../components/viewer/RepoFileTree';
import { ChunkSelectorTabs } from '../components/viewer/ChunkSelectorTabs';
import { AgenticLoopBanner } from '../components/chat/AgenticLoopBanner';
import { MessageList } from '../components/chat/MessageList';
import { CodeViewerHeader } from '../components/viewer/CodeViewerHeader';
import { SplitPaneLayout } from '../components/layout/SplitPaneLayout';
import { apiClient } from '../services/apiClient';
import { App } from '../App';
import { AstCodeChunk, AgentStatus } from '../types';

const mockChunks: AstCodeChunk[] = [
  {
    id: 'chunk-a',
    identifier: 'Session.send',
    filePath: 'fixtures/requests/sessions.py',
    fileName: 'sessions.py',
    astNodeType: 'FunctionDef',
    startLine: 680,
    endLine: 720,
    code: 'def send(self, request):\n    return request\n',
    relevanceScore: 0.94,
  },
  {
    id: 'chunk-b',
    identifier: 'HTTPAdapter',
    filePath: 'fixtures/requests/adapters.py',
    fileName: 'adapters.py',
    astNodeType: 'ClassDef',
    startLine: 70,
    endLine: 120,
    code: 'class HTTPAdapter:\n    pass\n',
    relevanceScore: 0.88,
  },
];

describe('Accessibility, Layout & Interaction Hardening Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ConnectRepoModal exposes dialog semantics, Escape/backdrop dismiss, and semantic button presets', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    vi.spyOn(apiClient, 'getRepositories').mockResolvedValue([]);

    render(
      <ConnectRepoModal
        isOpen={true}
        onClose={onClose}
        onIndexed={() => {}}
      />
    );

    const dialog = screen.getByTestId('connect-repo-modal');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'connect-repo-modal-title');

    // Switch to Index New tab to verify preset buttons are semantic <button> elements
    await user.click(screen.getByTestId('tab-add-repo'));
    expect(screen.getByTestId('preset-requests-btn').tagName).toBe('BUTTON');
    expect(screen.getByTestId('preset-sample-btn').tagName).toBe('BUTTON');

    // Escape key closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click closes modal
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('RepoFileTree renders keyboard-accessible <button> rows with aria-expanded and aria-current', async () => {
    const onSelectSymbol = vi.fn();
    vi.spyOn(apiClient, 'getRepoTree').mockResolvedValue({
      repo_id: 'requests',
      repo_name: 'psf/requests',
      total_files: 1,
      total_symbols: 1,
      tree: [
        {
          filePath: 'fixtures/requests/sessions.py',
          fileName: 'sessions.py',
          symbolsCount: 1,
          symbols: [
            {
              id: 'chunk-a',
              identifier: 'Session.send',
              astNodeType: 'FunctionDef',
              startLine: 680,
              endLine: 720,
            },
          ],
        },
      ],
    });

    render(
      <RepoFileTree
        repoId="requests"
        activeChunkId="chunk-a"
        onSelectSymbol={onSelectSymbol}
        onClose={() => {}}
      />
    );

    const symbolBtn = await waitFor(() => screen.getByTestId('tree-symbol-Session.send'));
    expect(symbolBtn.tagName).toBe('BUTTON');
    expect(symbolBtn).toHaveAttribute('aria-current', 'true');

    const fileGroup = screen.getByTestId('tree-file-sessions.py');
    const fileBtn = fileGroup.querySelector('button[aria-expanded]');
    expect(fileBtn).not.toBeNull();
    expect(fileBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('ChunkSelectorTabs exposes tablist/tab semantics and supports Arrow key navigation', () => {
    const onSelectChunk = vi.fn();

    render(
      <ChunkSelectorTabs
        chunks={mockChunks}
        selectedChunkId="chunk-a"
        onSelectChunk={onSelectChunk}
        onCloseChunk={() => {}}
      />
    );

    const tablist = screen.getByTestId('chunk-selector-tabs');
    expect(tablist).toHaveAttribute('role', 'tablist');

    const tabA = screen.getByTestId('chunk-tab-chunk-a');
    expect(tabA).toHaveAttribute('role', 'tab');
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(tabA).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(tabA, { key: 'ArrowRight' });
    expect(onSelectChunk).toHaveBeenCalledWith('chunk-b');
  });

  it('AgenticLoopBanner and MessageList expose live regions for assistive technologies', () => {
    const status: AgentStatus = {
      state: 'Thinking',
      currentStepMessage: 'Planning AST search...',
      elapsedMs: 400,
      activeChunkCount: 2,
    };

    render(
      <>
        <AgenticLoopBanner status={status} />
        <MessageList messages={[]} chunks={[]} onSelectChunk={() => {}} />
      </>
    );

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');

    const logRegion = screen.getByRole('log');
    expect(logRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('CodeViewerHeader flips Full File button label to Definition Only when active', () => {
    const { rerender } = render(
      <CodeViewerHeader
        chunk={mockChunks[0]}
        viewMode="code"
        isFullFileMode={false}
        onToggleFullFile={() => {}}
      />
    );

    expect(screen.getByTestId('toggle-full-file-btn')).toHaveTextContent('Full File');

    rerender(
      <CodeViewerHeader
        chunk={mockChunks[0]}
        viewMode="code"
        isFullFileMode={true}
        onToggleFullFile={() => {}}
      />
    );

    expect(screen.getByTestId('toggle-full-file-btn')).toHaveTextContent('Definition Only');
  });

  it('SplitPaneLayout separator supports touch-none and pointer-event resizing', () => {
    render(
      <SplitPaneLayout
        leftPane={<div>Left</div>}
        rightPane={<div>Right</div>}
      />
    );

    const separator = screen.getByRole('separator');
    expect(separator.className).toContain('touch-none');
  });

  it('App displays backend-offline-banner when backend health fails and dismisses it on Retry Connection', async () => {
    const user = userEvent.setup();
    const healthSpy = vi
      .spyOn(apiClient, 'getHealth')
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: 10,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      });

    render(<App />);

    const banner = await screen.findByTestId('backend-offline-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/uvicorn app\.main:app/i);

    await user.click(screen.getByTestId('retry-backend-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('backend-offline-banner')).not.toBeInTheDocument();
    });
    expect(healthSpy).toHaveBeenCalledTimes(2);
  });

  it('ConnectRepoModal shows local backend startup prompt when getRepositories rejects', async () => {
    vi.spyOn(apiClient, 'getRepositories').mockRejectedValueOnce(new Error('Network offline'));

    render(
      <ConnectRepoModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const offlineBox = await screen.findByTestId('modal-backend-offline');
    expect(offlineBox).toBeInTheDocument();
    expect(offlineBox).toHaveTextContent(/Local Backend Server Offline/i);
  });

  it('AgenticLoopBanner uses single-row nowrap container-query layout to prevent split-pane text collision', () => {
    const status: AgentStatus = {
      state: 'Synthesizing',
      currentStepMessage: 'Synthesizing answer...',
      elapsedMs: 1200,
      activeChunkCount: 3,
    };

    render(<AgenticLoopBanner status={status} chunkCount={3} />);

    const banner = screen.getByTestId('agentic-loop-banner');
    expect(banner.className).toContain('flex-nowrap');
    expect(banner.className).toContain('overflow-hidden');

    const stepper = screen.getByTestId('agentic-stepper');
    expect(stepper.className).toContain('@[760px]:flex');
  });
});
