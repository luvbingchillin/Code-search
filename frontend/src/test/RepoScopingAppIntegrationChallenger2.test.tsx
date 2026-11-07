import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiClient } from '../services/apiClient';
import { AstCodeChunk } from '../types';

describe('Challenger 2 Empirical Verification: Scope ReAct Agent Search Queries in App.tsx (Milestone 2)', () => {
  const requestsChunks: AstCodeChunk[] = [
    {
      id: 'chunk-req-1',
      filePath: 'fixtures/requests/sessions.py',
      fileName: 'sessions.py',
      astNodeType: 'FunctionDef',
      identifier: 'Session.send',
      startLine: 600,
      endLine: 650,
      code: 'def send(self, request, **kwargs):\n    """Send a given PreparedRequest."""\n    return Response()',
      relevanceScore: 0.98,
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
      code: 'def calculate_statistics(data):\n    """Compute statistics."""\n    return {"mean": 0}',
      relevanceScore: 0.95,
    },
  ];

  let searchSpy: any;
  let searchAstChunksSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    searchAstChunksSpy = vi.spyOn(apiClient, 'searchAstChunks').mockImplementation(
      async (query: string, options?: any) => {
        if (options?.filePath?.includes('requests')) {
          return requestsChunks;
        }
        if (options?.filePath?.includes('sample_codebase')) {
          return sampleCodebaseChunks;
        }
        return requestsChunks;
      }
    );

    searchSpy = vi.spyOn(apiClient, 'search').mockImplementation(async (req: any) => {
      if (req.file_path?.includes('requests')) {
        return {
          query: req.query,
          total_results: 1,
          chunks: requestsChunks,
          latency_ms: 10,
        };
      }
      if (req.file_path?.includes('sample_codebase')) {
        return {
          query: req.query,
          total_results: 1,
          chunks: sampleCodebaseChunks,
          latency_ms: 10,
        };
      }
      return {
        query: req.query,
        total_results: 1,
        chunks: requestsChunks,
        latency_ms: 10,
      };
    });
  });

  it('1. App initializes with activeRepo = null, passes undefined activeRepoPath, and executes search without filePath', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Verify initial header state shows default "Repositories" (no active repository)
    const connectRepoBtn = screen.getByTestId('connect-repo-btn');
    expect(connectRepoBtn).toHaveTextContent('Repositories');

    // Submit an initial query without any repository connected
    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');

    await user.type(input, 'General Python AST question');
    await user.click(sendBtn);

    // Verify agent search is executed without error
    await waitFor(() => {
      expect(searchAstChunksSpy).toHaveBeenCalled();
    });

    // Check calls made by the agent
    const agentCalls = searchAstChunksSpy.mock.calls.filter(
      (c: any[]) => c[0] === 'General Python AST question'
    );
    expect(agentCalls.length).toBeGreaterThan(0);
    // Verified: No filePath options passed when activeRepo is null
    expect(agentCalls[0][1]).toBeUndefined();
  });

  it('2. Selecting a repository in ConnectRepoModal updates activeRepo and scopes subsequent queries to activeRepoPath', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Step A: Open ConnectRepoModal
    const connectRepoBtn = screen.getByTestId('connect-repo-btn');
    await user.click(connectRepoBtn);

    await waitFor(() => {
      expect(screen.getByTestId('connect-repo-modal')).toBeInTheDocument();
      expect(screen.getByTestId('repo-card-requests')).toBeInTheDocument();
    });

    // Step B: Select 'psf/requests' (path: 'fixtures/requests')
    const openRequestsBtn = screen.getByTestId('open-repo-btn-requests');
    await user.click(openRequestsBtn);

    // Step C: Verify modal closed and Header reflects active repo
    await waitFor(() => {
      expect(screen.queryByTestId('connect-repo-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('psf/requests');
    });

    // Clear initial mock calls from repo selection bootstrap
    searchAstChunksSpy.mockClear();

    // Step D: Submit subsequent query via Chat
    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');

    await user.type(input, 'Where is Session.send');
    await user.click(sendBtn);

    // Step E: Verify searchAstChunks was invoked with { filePath: 'fixtures/requests' }
    await waitFor(() => {
      const scopedCalls = searchAstChunksSpy.mock.calls.filter(
        (c: any[]) => c[0] === 'Where is Session.send'
      );
      expect(scopedCalls.length).toBeGreaterThan(0);
      expect(scopedCalls[0][1]).toEqual({ filePath: 'fixtures/requests' });
    });
  });

  it(
    '3. Dynamic repository switching in App.tsx updates activeRepo and switches search filter without remounting',
    async () => {
    const user = userEvent.setup();
    render(<App />);

    // 1. Connect first repo: psf/requests
    await user.click(screen.getByTestId('connect-repo-btn'));
    await waitFor(() => expect(screen.getByTestId('open-repo-btn-requests')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-repo-btn-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('psf/requests');
    });

    searchAstChunksSpy.mockClear();

    // Query 1 scoped to requests
    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');
    await user.type(input, 'Query requests');
    await user.click(sendBtn);

    await waitFor(() => {
      const calls = searchAstChunksSpy.mock.calls.filter((c: any[]) => c[0] === 'Query requests');
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1]).toEqual({ filePath: 'fixtures/requests' });
    });

    // Wait for query 1 to fully complete before switching repo or sending next query
    await waitFor(
      () => {
        expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Complete');
        expect(screen.getByTestId('chat-send-btn')).toBeInTheDocument();
      },
      { timeout: 20000 }
    );

    // 2. Dynamically switch to second repo: sample_codebase
    await user.click(screen.getByTestId('connect-repo-btn'));
    await waitFor(() => expect(screen.getByTestId('open-repo-btn-sample_codebase')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-repo-btn-sample_codebase'));

    await waitFor(() => {
      expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('sample_codebase');
    });

    searchAstChunksSpy.mockClear();

    // Query 2 scoped to sample_codebase
    await user.type(input, 'Query calculator');
    await user.click(sendBtn);

    await waitFor(() => {
      const calls = searchAstChunksSpy.mock.calls.filter((c: any[]) => c[0] === 'Query calculator');
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1]).toEqual({ filePath: 'backend/sample_codebase' });
    });
  }, 30000);

  it('4. Survives backend errors when loading initial repo chunks without breaking subsequent scoped queries', async () => {
    const user = userEvent.setup();
    // Simulate apiClient.getRepoChunks network error
    vi.spyOn(apiClient, 'getRepoChunks').mockRejectedValue(new Error('500 Server Error'));

    render(<App />);

    // Open and select repo
    await user.click(screen.getByTestId('connect-repo-btn'));
    await waitFor(() => expect(screen.getByTestId('open-repo-btn-requests')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-repo-btn-requests'));

    // Modal still closes and activeRepo is set
    await waitFor(() => {
      expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('psf/requests');
    });

    searchAstChunksSpy.mockClear();

    // Query after error still carries the activeRepoPath
    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');
    await user.type(input, 'Query after chunk load error');
    await user.click(sendBtn);

    await waitFor(() => {
      const calls = searchAstChunksSpy.mock.calls.filter(
        (c: any[]) => c[0] === 'Query after chunk load error'
      );
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1]).toEqual({ filePath: 'fixtures/requests' });
    });
  });

  it('5. Cancelling a query mid-search retains activeRepo and scopes the subsequent query', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Select requests repo
    await user.click(screen.getByTestId('connect-repo-btn'));
    await waitFor(() => expect(screen.getByTestId('open-repo-btn-requests')).toBeInTheDocument());
    await user.click(screen.getByTestId('open-repo-btn-requests'));

    await waitFor(() => {
      expect(screen.getByTestId('connect-repo-btn')).toHaveTextContent('psf/requests');
    });

    searchAstChunksSpy.mockClear();

    // Start query 1 and cancel immediately
    const input = screen.getByTestId('chat-input-textarea');
    const sendBtn = screen.getByTestId('chat-send-btn');
    await user.type(input, 'Query to cancel');
    await user.click(sendBtn);

    // Stop button appears when busy
    const stopBtn = await screen.findByTestId('chat-stop-btn');
    await user.click(stopBtn);

    // Wait for agent to reset back to Idle
    await waitFor(() => {
      expect(screen.getByTestId('agentic-state-label')).toHaveTextContent('Idle');
      expect(screen.getByTestId('chat-send-btn')).toBeInTheDocument();
    });

    searchAstChunksSpy.mockClear();

    // Submit subsequent query after cancellation
    await user.type(input, 'Fresh query after cancel');
    await user.click(screen.getByTestId('chat-send-btn'));

    // Verify subsequent query is still scoped to activeRepoPath
    await waitFor(() => {
      const calls = searchAstChunksSpy.mock.calls.filter(
        (c: any[]) => c[0] === 'Fresh query after cancel'
      );
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][1]).toEqual({ filePath: 'fixtures/requests' });
    });
  });

  it('6. ConnectRepoModal indexing triggers nemoIR initial search with { filePath: repoPath }', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open modal
    await user.click(screen.getByTestId('connect-repo-btn'));
    await waitFor(() => expect(screen.getByTestId('tab-add-repo')).toBeInTheDocument());

    // Switch to Add New Repository tab
    await user.click(screen.getByTestId('tab-add-repo'));

    // Click preset for psf/requests
    const presetBtn = screen.getByTestId('preset-requests-btn');
    await user.click(presetBtn);

    searchAstChunksSpy.mockClear();

    // Click Index & Connect
    const indexBtn = screen.getByTestId('trigger-index-btn');
    await user.click(indexBtn);

    // Verify onIndexed in App calls nemoIR.searchAstChunks('def ', { filePath: 'fixtures/requests' })
    await waitFor(() => {
      const initialCalls = searchAstChunksSpy.mock.calls.filter(
        (c: any[]) => c[0] === 'def '
      );
      expect(initialCalls.length).toBeGreaterThan(0);
      expect(initialCalls[0][1]).toEqual({ filePath: 'fixtures/requests' });
    });
  });
});
