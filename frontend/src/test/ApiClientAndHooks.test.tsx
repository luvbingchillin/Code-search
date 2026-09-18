import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ApiClient, apiClient } from '../services/apiClient';
import { useNemoIR } from '../hooks/useNemoIR';
import { useReActAgent } from '../hooks/useReActAgent';
import { UseWebLLMReturn, UseNemoIRReturn, AstCodeChunk } from '../types';

describe('ApiClient Unit & Routing Suite', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({ baseUrl: 'http://localhost:8000' });
  });

  it('normalizes base URL by stripping trailing slashes', () => {
    const c1 = new ApiClient({ baseUrl: 'http://localhost:8000///' });
    expect(c1.getBaseUrl()).toBe('http://localhost:8000');

    c1.setBaseUrl('http://api.backend.local:9000//');
    expect(c1.getBaseUrl()).toBe('http://api.backend.local:9000');
  });

  it('getHealth retrieves health and index stats from /api/v1/health', async () => {
    const health = await client.getHealth();
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('vector_db');
    expect(health).toHaveProperty('total_chunks');
  });

  it('search executes POST /api/v1/search with typed query parameters', async () => {
    const res = await client.search({
      query: 'connection pool',
      top_k: 3,
      ast_node_type: 'ClassDef',
    });

    expect(res).toHaveProperty('query');
    expect(res).toHaveProperty('chunks');
    expect(Array.isArray(res.chunks)).toBe(true);
    expect(res.chunks.length).toBeLessThanOrEqual(3);
  });

  it('lookupEntity executes GET /api/v1/entity/{encoded}', async () => {
    const res = await client.lookupEntity('Session.request');
    expect(res).toHaveProperty('identifier');
    expect(res).toHaveProperty('chunks');
    expect(Array.isArray(res.chunks)).toBe(true);
  });

  it('getChunkById executes GET /api/v1/chunks/{encoded}', async () => {
    const res = await client.getChunkById('requests-sessions-session-request');
    expect(res).toHaveProperty('id');
    expect(res).toHaveProperty('code');
  });

  it('searchAstChunks returns empty array when query is whitespace', async () => {
    const results = await client.searchAstChunks('   ');
    expect(results).toEqual([]);
  });

  it('searchAstChunks routes to lookupEntity when searchType is "exact"', async () => {
    const lookupSpy = vi.spyOn(client, 'lookupEntity');
    const searchSpy = vi.spyOn(client, 'search');

    await client.searchAstChunks('Session.send', { searchType: 'exact', topK: 2 });

    expect(lookupSpy).toHaveBeenCalledWith('Session.send', expect.any(Object));
    expect(searchSpy).not.toHaveBeenCalled();
    lookupSpy.mockRestore();
    searchSpy.mockRestore();
  });

  it('searchAstChunks routes to lookupEntity when exactMatch is true', async () => {
    const lookupSpy = vi.spyOn(client, 'lookupEntity');
    const searchSpy = vi.spyOn(client, 'search');

    await client.searchAstChunks('HTTPAdapter', { exactMatch: true });

    expect(lookupSpy).toHaveBeenCalledWith('HTTPAdapter', expect.any(Object));
    expect(searchSpy).not.toHaveBeenCalled();
    lookupSpy.mockRestore();
    searchSpy.mockRestore();
  });

  it('searchAstChunks routes to lookupEntity when query starts with "entity:" or "exact:"', async () => {
    const lookupSpy = vi.spyOn(client, 'lookupEntity');
    const searchSpy = vi.spyOn(client, 'search');

    await client.searchAstChunks('entity: prepare_request');
    expect(lookupSpy).toHaveBeenCalledWith('prepare_request', expect.any(Object));

    await client.searchAstChunks('exact:clean_url');
    expect(lookupSpy).toHaveBeenCalledWith('clean_url', expect.any(Object));

    expect(searchSpy).not.toHaveBeenCalled();
    lookupSpy.mockRestore();
    searchSpy.mockRestore();
  });

  it('searchAstChunks routes to lookupEntity when filters.identifier is provided', async () => {
    const lookupSpy = vi.spyOn(client, 'lookupEntity');
    const searchSpy = vi.spyOn(client, 'search');

    await client.searchAstChunks('some query', { filters: { identifier: 'resolve_redirects' } });

    expect(lookupSpy).toHaveBeenCalledWith('resolve_redirects', expect.any(Object));
    expect(searchSpy).not.toHaveBeenCalled();
    lookupSpy.mockRestore();
    searchSpy.mockRestore();
  });

  it('searchAstChunks routes to semantic search by default', async () => {
    const lookupSpy = vi.spyOn(client, 'lookupEntity');
    const searchSpy = vi.spyOn(client, 'search');

    const results = await client.searchAstChunks('retry connection handler', { topK: 4 });

    expect(searchSpy).toHaveBeenCalledWith(
      {
        query: 'retry connection handler',
        top_k: 4,
        ast_node_type: undefined,
        file_path: undefined,
      },
      expect.any(Object)
    );
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(Array.isArray(results)).toBe(true);
    lookupSpy.mockRestore();
    searchSpy.mockRestore();
  });

  it('singleton apiClient is exported and configured', () => {
    expect(apiClient).toBeInstanceOf(ApiClient);
    expect(apiClient.getBaseUrl()).toBe('http://localhost:8000');
  });
});

describe('useNemoIR Hook Integration Suite', () => {
  it('provides ready status and searchAstChunks delegation to apiClient', async () => {
    const { result } = renderHook(() => useNemoIR());

    expect(result.current.wasmStatus).toBe('ready');
    expect(result.current.isReady).toBe(true);

    const chunks = await result.current.searchAstChunks('authentication header');
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('identifier');
  });

  it('provides lookupEntity delegation for multi-hop resolution', async () => {
    const { result } = renderHook(() => useNemoIR());

    expect(typeof result.current.lookupEntity).toBe('function');
    const chunks = await result.current.lookupEntity!('Session');
    expect(Array.isArray(chunks)).toBe(true);
  });

  it('initNemo calls health check and maintains ready state', async () => {
    const { result } = renderHook(() => useNemoIR());

    await act(async () => {
      await result.current.initNemo();
    });

    expect(result.current.wasmStatus).toBe('ready');
  });
});

describe('useReActAgent with NemoIR Ast Chunks Wiring Suite', () => {
  it('wires nemoIR searchAstChunks into Searching AST phase when WebLLM is ready', async () => {
    const sampleChunks: AstCodeChunk[] = [
      {
        id: 'chunk-test-1',
        filePath: 'requests/models.py',
        fileName: 'models.py',
        astNodeType: 'ClassDef',
        identifier: 'PreparedRequest',
        startLine: 10,
        endLine: 40,
        code: 'class PreparedRequest:\n    def __init__(self):\n        pass',
        relevanceScore: 0.95,
        language: 'python',
        repoFullName: 'psf/requests',
      },
    ];

    const mockSearchAstChunks = vi.fn().mockResolvedValue(sampleChunks);

    const mockNemoIR: UseNemoIRReturn = {
      wasmStatus: 'ready',
      isReady: true,
      initNemo: vi.fn().mockResolvedValue(undefined),
      searchAstChunks: mockSearchAstChunks,
      lookupEntity: vi.fn().mockResolvedValue(sampleChunks),
      executeWorkflow: vi.fn().mockResolvedValue({}),
    };

    const mockWebLLM: UseWebLLMReturn = {
      status: 'ready',
      progress: 1,
      progressText: 'Ready',
      currentModel: 'Qwen2.5-Coder-1.5B',
      error: null,
      isWebGPUSupported: true,
      engine: {},
      loadModel: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn().mockImplementation(async (_prompt, onToken) => {
        if (onToken) {
          onToken('Generated ', 'Generated ');
          onToken('response', 'Generated response');
        }
        return 'Generated response';
      }),
      generateStream: vi.fn().mockResolvedValue('Generated response'),
      initEngine: vi.fn().mockResolvedValue(undefined),
      interrupt: vi.fn(),
      unload: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() =>
      useReActAgent({ webLLM: mockWebLLM, nemoIR: mockNemoIR })
    );

    await act(async () => {
      const promise = result.current.submitQuery('Find PreparedRequest');
      await promise;
    });

    expect(mockSearchAstChunks).toHaveBeenCalledWith('Find PreparedRequest');
    expect(result.current.activeChunks).toEqual(sampleChunks);
    expect(result.current.selectedChunkId).toBe('chunk-test-1');
    expect(result.current.agentStatus.state).toBe('Complete');
  });
});
