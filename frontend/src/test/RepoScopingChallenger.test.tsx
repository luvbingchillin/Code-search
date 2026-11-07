import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useReActAgent, UseReActAgentOptions } from '../hooks/useReActAgent';
import { ApiClient } from '../services/apiClient';
import { UseWebLLMReturn, UseNemoIRReturn, AstCodeChunk } from '../types';

describe('Challenger 1 Empirical Stress Test: Scope ReAct Agent Search Queries (Milestone 2)', () => {
  const mockChunksReq: AstCodeChunk[] = [
    {
      id: 'chunk-req-1',
      filePath: 'fixtures/requests/sessions.py',
      fileName: 'sessions.py',
      astNodeType: 'ClassDef',
      identifier: 'Session',
      startLine: 350,
      endLine: 800,
      code: 'class Session(SessionRedirectMixin):\n    def __init__(self):\n        pass',
      relevanceScore: 0.98,
    },
  ];

  const mockChunksCalc: AstCodeChunk[] = [
    {
      id: 'chunk-calc-1',
      filePath: 'backend/sample_codebase/calculator.py',
      fileName: 'calculator.py',
      astNodeType: 'FunctionDef',
      identifier: 'calculate_statistics',
      startLine: 10,
      endLine: 30,
      code: 'def calculate_statistics(data): pass',
      relevanceScore: 0.95,
    },
  ];

  let mockSearch: ReturnType<typeof vi.fn>;
  let mockNemoIR: UseNemoIRReturn;
  let mockWebLLM: UseWebLLMReturn;

  beforeEach(() => {
    mockSearch = vi.fn().mockImplementation(async (_query: string, options?: any) => {
      if (options?.filePath?.includes('requests')) {
        return mockChunksReq;
      }
      if (options?.filePath?.includes('sample_codebase')) {
        return mockChunksCalc;
      }
      return mockChunksReq;
    });

    mockNemoIR = {
      wasmStatus: 'ready',
      isReady: true,
      initNemo: vi.fn(),
      searchAstChunks: mockSearch,
      lookupEntity: vi.fn(),
      executeWorkflow: vi.fn().mockResolvedValue({ success: true }),
    };

    mockWebLLM = {
      status: 'ready',
      progress: 1,
      progressText: 'Ready',
      currentModel: 'Qwen2.5-Coder',
      error: null,
      isWebGPUSupported: true,
      engine: {},
      loadModel: vi.fn(),
      generate: vi.fn().mockResolvedValue('Generated response citing AST context.'),
      generateStream: vi.fn(),
      initEngine: vi.fn(),
      interrupt: vi.fn(),
      unload: vi.fn(),
    };
  });

  it('H1 [WebLLM]: Strictly passes { filePath: activeRepoPath } when activeRepoPath is set', async () => {
    const { result } = renderHook(() =>
      useReActAgent({
        webLLM: mockWebLLM,
        nemoIR: mockNemoIR,
        activeRepoPath: 'fixtures/requests',
      })
    );

    await act(async () => {
      await result.current.submitQuery('Where is Session?');
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('Where is Session?', {
      filePath: 'fixtures/requests',
    });
    expect(result.current.activeChunks).toEqual(mockChunksReq);
    expect(result.current.agentStatus.state).toBe('Complete');
  });

  it('H2 [Simulator]: Strictly passes { filePath: activeRepoPath } when activeRepoPath is set', async () => {
    const { result } = renderHook(() =>
      useReActAgent({
        nemoIR: mockNemoIR,
        activeRepoPath: 'backend/sample_codebase',
      })
    );

    await act(async () => {
      await result.current.submitQuery('How does calculate_statistics work?');
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('How does calculate_statistics work?', {
      filePath: 'backend/sample_codebase',
    });
    expect(result.current.activeChunks).toEqual(mockChunksCalc);
    expect(result.current.agentStatus.state).toBe('Complete');
  });

  it('H3 [Unscoped]: Calls searchAstChunks(query) with exactly 1 argument when activeRepoPath is omitted or undefined', async () => {
    const { result } = renderHook(() =>
      useReActAgent({
        webLLM: mockWebLLM,
        nemoIR: mockNemoIR,
      })
    );

    await act(async () => {
      await result.current.submitQuery('General query');
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    // Must be called with single argument, NOT undefined as second arg
    expect(mockSearch.mock.calls[0].length).toBe(1);
    expect(mockSearch.mock.calls[0][0]).toBe('General query');
    expect(mockSearch.mock.calls[0][1]).toBeUndefined();
  });

  it('H4 [Falsy/Empty RepoPath]: Calls searchAstChunks(query) with 1 argument when activeRepoPath is empty string', async () => {
    const { result } = renderHook(() =>
      useReActAgent({
        webLLM: mockWebLLM,
        nemoIR: mockNemoIR,
        activeRepoPath: '',
      })
    );

    await act(async () => {
      await result.current.submitQuery('Empty repo path test');
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch.mock.calls[0].length).toBe(1);
    expect(mockSearch.mock.calls[0][0]).toBe('Empty repo path test');
  });

  it('H5 [Dynamic Updates without Remount - WebLLM]: Updates search filter dynamically across multiple queries', async () => {
    let currentOptions: UseReActAgentOptions = {
      webLLM: mockWebLLM,
      nemoIR: mockNemoIR,
      activeRepoPath: undefined,
    };

    const { result, rerender } = renderHook(
      (props: UseReActAgentOptions) => useReActAgent(props),
      { initialProps: currentOptions }
    );

    // 1. Initial query without activeRepoPath
    await act(async () => {
      await result.current.submitQuery('Query 1 without repo');
    });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch.mock.calls[0].length).toBe(1);
    expect(mockSearch.mock.calls[0][0]).toBe('Query 1 without repo');

    // 2. Dynamic switch to 'fixtures/requests'
    currentOptions = {
      webLLM: mockWebLLM,
      nemoIR: mockNemoIR,
      activeRepoPath: 'fixtures/requests',
    };
    rerender(currentOptions);

    await act(async () => {
      await result.current.submitQuery('Query 2 for requests');
    });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockSearch.mock.calls[1][0]).toBe('Query 2 for requests');
    expect(mockSearch.mock.calls[1][1]).toEqual({ filePath: 'fixtures/requests' });

    // 3. Dynamic switch to 'backend/sample_codebase'
    currentOptions = {
      webLLM: mockWebLLM,
      nemoIR: mockNemoIR,
      activeRepoPath: 'backend/sample_codebase',
    };
    rerender(currentOptions);

    await act(async () => {
      await result.current.submitQuery('Query 3 for sample_codebase');
    });
    expect(mockSearch).toHaveBeenCalledTimes(3);
    expect(mockSearch.mock.calls[2][0]).toBe('Query 3 for sample_codebase');
    expect(mockSearch.mock.calls[2][1]).toEqual({ filePath: 'backend/sample_codebase' });

    // 4. Dynamic switch back to undefined
    currentOptions = {
      webLLM: mockWebLLM,
      nemoIR: mockNemoIR,
      activeRepoPath: undefined,
    };
    rerender(currentOptions);

    await act(async () => {
      await result.current.submitQuery('Query 4 unscoped');
    });
    expect(mockSearch).toHaveBeenCalledTimes(4);
    expect(mockSearch.mock.calls[3].length).toBe(1);
    expect(mockSearch.mock.calls[3][0]).toBe('Query 4 unscoped');
  });

  it('H6 [Dynamic Updates without Remount - Simulator]: Updates search filter dynamically in simulator fallback branch', async () => {
    let currentOptions: UseReActAgentOptions = {
      nemoIR: mockNemoIR,
      activeRepoPath: 'repo-alpha',
    };

    const { result, rerender } = renderHook(
      (props: UseReActAgentOptions) => useReActAgent(props),
      { initialProps: currentOptions }
    );

    await act(async () => {
      await result.current.submitQuery('Sim Query 1');
    });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch.mock.calls[0]).toEqual(['Sim Query 1', { filePath: 'repo-alpha' }]);

    // Update to repo-beta
    rerender({
      nemoIR: mockNemoIR,
      activeRepoPath: 'repo-beta',
    });

    await act(async () => {
      await result.current.submitQuery('Sim Query 2');
    });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockSearch.mock.calls[1]).toEqual(['Sim Query 2', { filePath: 'repo-beta' }]);

    // Update to empty string
    rerender({
      nemoIR: mockNemoIR,
      activeRepoPath: '',
    });

    await act(async () => {
      await result.current.submitQuery('Sim Query 3');
    });
    expect(mockSearch).toHaveBeenCalledTimes(3);
    expect(mockSearch.mock.calls[2].length).toBe(1);
    expect(mockSearch.mock.calls[2][0]).toBe('Sim Query 3');
  });

  it('H7 [Graceful Degradation]: Simulator branch survives if nemoIR.searchAstChunks throws', async () => {
    const errorNemoIR: UseNemoIRReturn = {
      ...mockNemoIR,
      searchAstChunks: vi.fn().mockRejectedValue(new Error('Backend connection refused')),
    };

    const { result } = renderHook(() =>
      useReActAgent({
        nemoIR: errorNemoIR,
        activeRepoPath: 'fixtures/requests',
      })
    );

    // Should not reject or crash the hook
    await act(async () => {
      await result.current.submitQuery('Resilience check');
    });

    expect(errorNemoIR.searchAstChunks).toHaveBeenCalledWith('Resilience check', {
      filePath: 'fixtures/requests',
    });
    expect(result.current.agentStatus.state).toBe('Complete');
    expect(result.current.messages.length).toBeGreaterThan(1);
  });

  it('H8 [E2E ApiClient Scoping]: ApiClient sends file_path in POST /api/v1/search request body', async () => {
    const client = new ApiClient({ baseUrl: 'http://localhost:8000' });
    const originalFetch = global.fetch;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Session',
        total_results: 1,
        chunks: mockChunksReq,
        latency_ms: 12,
      }),
    });
    global.fetch = mockFetch;

    try {
      // 1. With filePath option
      await client.searchAstChunks('Session', { filePath: 'fixtures/requests' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(call1Body.query).toBe('Session');
      expect(call1Body.file_path).toBe('fixtures/requests');

      // 2. Without options
      await client.searchAstChunks('Session');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const call2Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(call2Body.query).toBe('Session');
      expect(call2Body.file_path).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
