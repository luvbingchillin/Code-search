import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepoFileTree } from '../components/viewer/RepoFileTree';
import { apiClient } from '../services/apiClient';
import { RepositoryTreeResponse } from '../types';

describe('RepoFileTree Component Suite', () => {
  const mockTree: RepositoryTreeResponse = {
    repo_id: 'requests',
    repo_name: 'psf/requests',
    total_files: 2,
    total_symbols: 3,
    tree: [
      {
        filePath: 'sessions.py',
        fileName: 'sessions.py',
        symbolsCount: 2,
        symbols: [
          {
            id: 'sessions.py:Session:356',
            identifier: 'Session',
            astNodeType: 'ClassDef',
            startLine: 356,
            endLine: 816,
          },
          {
            id: 'sessions.py:Session.send:600',
            identifier: 'Session.send',
            astNodeType: 'FunctionDef',
            startLine: 600,
            endLine: 650,
          },
        ],
      },
      {
        filePath: 'adapters.py',
        fileName: 'adapters.py',
        symbolsCount: 1,
        symbols: [
          {
            id: 'adapters.py:HTTPAdapter:50',
            identifier: 'HTTPAdapter',
            astNodeType: 'ClassDef',
            startLine: 50,
            endLine: 400,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty placeholder when repoId is null', () => {
    render(
      <RepoFileTree
        repoId={null}
        activeChunkId={null}
        onSelectSymbol={vi.fn()}
      />
    );
    expect(screen.getByTestId('repo-file-tree')).toBeInTheDocument();
    expect(screen.getByText(/Connect a repository to browse source files/i)).toBeInTheDocument();
  });

  it('fetches and displays file nodes and nested symbols when repoId is provided', async () => {
    vi.spyOn(apiClient, 'getRepoTree').mockResolvedValue(mockTree);

    render(
      <RepoFileTree
        repoId="requests"
        activeChunkId="sessions.py:Session:356"
        onSelectSymbol={vi.fn()}
      />
    );

    expect(await screen.findByText('sessions.py')).toBeInTheDocument();
    expect(screen.getByText('adapters.py')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();

    // Verify symbols inside initial expanded files
    expect(await screen.findByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Session.send')).toBeInTheDocument();
  });

  it('invokes onSelectSymbol when clicking a symbol node', async () => {
    vi.spyOn(apiClient, 'getRepoTree').mockResolvedValue(mockTree);
    const handleSelectSymbol = vi.fn();
    const user = userEvent.setup();

    render(
      <RepoFileTree
        repoId="requests"
        activeChunkId={null}
        onSelectSymbol={handleSelectSymbol}
      />
    );

    const sessionNode = await screen.findByText('Session');
    await user.click(sessionNode);

    expect(handleSelectSymbol).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sessions.py:Session:356',
        identifier: 'Session',
      }),
      'sessions.py'
    );
  });

  it('filters file and symbol tree via search input', async () => {
    vi.spyOn(apiClient, 'getRepoTree').mockResolvedValue(mockTree);
    const user = userEvent.setup();

    render(
      <RepoFileTree
        repoId="requests"
        activeChunkId={null}
        onSelectSymbol={vi.fn()}
      />
    );

    await screen.findByText('sessions.py');
    const input = screen.getByTestId('file-tree-filter-input');

    // Filter for HTTPAdapter in adapters.py
    await user.type(input, 'HTTPAdapter');

    expect(screen.getByText('adapters.py')).toBeInTheDocument();
    expect(screen.getByText('HTTPAdapter')).toBeInTheDocument();
    expect(screen.queryByText('sessions.py')).not.toBeInTheDocument();
  });

  it('invokes onClose when close explorer button is clicked', async () => {
    vi.spyOn(apiClient, 'getRepoTree').mockResolvedValue(mockTree);
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <RepoFileTree
        repoId="requests"
        activeChunkId={null}
        onSelectSymbol={vi.fn()}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByTestId('close-explorer-btn');
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
