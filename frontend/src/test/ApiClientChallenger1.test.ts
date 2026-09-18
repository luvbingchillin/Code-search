import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, apiClient } from '../services/apiClient';
import { renderHook, act } from '@testing-library/react';
import { useNemoIR } from '../hooks/useNemoIR';
import { AstCodeChunk } from '../types';

describe('Empirical Challenger 1: ApiClient Dynamic Routing, Error Handling & Abort Suite', () => {
  let client: ApiClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    client = new ApiClient({ baseUrl: 'http://localhost:8000', timeoutMs: 5000 });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Dynamic Routing Verification (Semantic vs. Exact Queries)
  // =========================================================================
  describe('1. Dynamic Routing & Query Disambiguation', () => {
    it('routes standard natural language queries to semantic search with default top_k=5', async () => {
      const searchSpy = vi.spyOn(client, 'search').mockResolvedValue({
        query: 'how to create a session',
        total_results: 1,
        chunks: [{ id: 'c1', identifier: 'Session' } as AstCodeChunk],
        latency_ms: 5,
      });
      const lookupSpy = vi.spyOn(client, 'lookupEntity');

      const results = await client.searchAstChunks('how to create a session');

      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith(
        {
          query: 'how to create a session',
          top_k: 5,
          ast_node_type: undefined,
          file_path: undefined,
        },
        { signal: undefined }
      );
      expect(lookupSpy).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].identifier).toBe('Session');
    });

    it('propagates custom topK, astNodeType, and filePath filters to semantic search', async () => {
      const searchSpy = vi.spyOn(client, 'search').mockResolvedValue({
        query: 'parse headers',
        total_results: 2,
        chunks: [
          { id: 'c1', identifier: 'parse_header_links' } as AstCodeChunk,
          { id: 'c2', identifier: 'HeaderParsingError' } as AstCodeChunk,
        ],
        latency_ms: 8,
      });

      const results = await client.searchAstChunks('parse headers', {
        topK: 12,
        filters: {
          astNodeType: 'FunctionDef',
          filePath: 'requests/utils.py',
        },
      });

      expect(searchSpy).toHaveBeenCalledWith(
        {
          query: 'parse headers',
          top_k: 12,
          ast_node_type: 'FunctionDef',
          file_path: 'requests/utils.py',
        },
        { signal: undefined }
      );
      expect(results).toHaveLength(2);
    });

    it('routes prefix "entity:<target>" to lookupEntity with stripped prefix', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'Session.request',
        count: 1,
        chunks: [{ id: 'c1', identifier: 'Session.request' } as AstCodeChunk],
      });
      const searchSpy = vi.spyOn(client, 'search');

      const results = await client.searchAstChunks('entity:Session.request');

      expect(lookupSpy).toHaveBeenCalledTimes(1);
      expect(lookupSpy).toHaveBeenCalledWith('Session.request', { signal: undefined });
      expect(searchSpy).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('routes prefix "exact:<target>" with trailing whitespace and spaces after colon', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'HTTPAdapter',
        count: 1,
        chunks: [{ id: 'c2', identifier: 'HTTPAdapter' } as AstCodeChunk],
      });

      await client.searchAstChunks('exact:   HTTPAdapter');

      expect(lookupSpy).toHaveBeenCalledWith('HTTPAdapter', { signal: undefined });
    });

    it('routes to lookupEntity when options.searchType is "exact"', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'get_netrc_auth',
        count: 1,
        chunks: [{ id: 'c3', identifier: 'get_netrc_auth' } as AstCodeChunk],
      });

      const results = await client.searchAstChunks('get_netrc_auth', { searchType: 'exact' });

      expect(lookupSpy).toHaveBeenCalledWith('get_netrc_auth', { signal: undefined });
      expect(results[0].identifier).toBe('get_netrc_auth');
    });

    it('routes to lookupEntity when options.exactMatch is true', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'CaseInsensitiveDict',
        count: 1,
        chunks: [{ id: 'c4', identifier: 'CaseInsensitiveDict' } as AstCodeChunk],
      });

      await client.searchAstChunks('CaseInsensitiveDict', { exactMatch: true });

      expect(lookupSpy).toHaveBeenCalledWith('CaseInsensitiveDict', { signal: undefined });
    });

    it('routes to lookupEntity using options.filters.identifier when supplied', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'dispatch_hook',
        count: 1,
        chunks: [{ id: 'c5', identifier: 'dispatch_hook' } as AstCodeChunk],
      });

      await client.searchAstChunks('natural query about hooks', {
        filters: { identifier: 'dispatch_hook' },
      });

      expect(lookupSpy).toHaveBeenCalledWith('dispatch_hook', { signal: undefined });
    });

    it('routes to lookupEntity using options.identifier when supplied directly', async () => {
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'extract_cookies_to_jar',
        count: 1,
        chunks: [{ id: 'c6', identifier: 'extract_cookies_to_jar' } as AstCodeChunk],
      });

      await client.searchAstChunks('find cookie extractor', {
        identifier: 'extract_cookies_to_jar',
      });

      expect(lookupSpy).toHaveBeenCalledWith('extract_cookies_to_jar', { signal: undefined });
    });

    it('slices lookupEntity chunks according to topK if provided', async () => {
      const fourChunks: AstCodeChunk[] = [
        { id: '1', identifier: 'foo' } as AstCodeChunk,
        { id: '2', identifier: 'foo' } as AstCodeChunk,
        { id: '3', identifier: 'foo' } as AstCodeChunk,
        { id: '4', identifier: 'foo' } as AstCodeChunk,
      ];
      vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'foo',
        count: 4,
        chunks: fourChunks,
      });

      const sliced = await client.searchAstChunks('entity:foo', { topK: 2 });
      expect(sliced).toHaveLength(2);
      expect(sliced.map((c) => c.id)).toEqual(['1', '2']);

      const nonSliced = await client.searchAstChunks('entity:foo', { topK: 0 });
      expect(nonSliced).toHaveLength(4);
    });

    it('short-circuits empty and whitespace-only queries to [] without issuing network calls', async () => {
      const searchSpy = vi.spyOn(client, 'search');
      const lookupSpy = vi.spyOn(client, 'lookupEntity');

      const emptyRes = await client.searchAstChunks('');
      const wsRes = await client.searchAstChunks('   \t\r\n   ');

      expect(emptyRes).toEqual([]);
      expect(wsRes).toEqual([]);
      expect(searchSpy).not.toHaveBeenCalled();
      expect(lookupSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. URL Encoding & Special Characters in Identifiers
  // =========================================================================
  describe('2. URL Encoding & Special Character Handling', () => {
    it('properly encodes special characters, slashes, spaces, and query symbols in lookupEntity', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return new Response(
          JSON.stringify({ identifier: 'test', count: 1, chunks: [{ id: 'c1' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const complexId = 'requests/sessions.py::Session.request?v=1&foo=bar#section+1';
      await client.lookupEntity(complexId);

      expect(requestedUrl).toBe(
        `http://localhost:8000/api/v1/entity/${encodeURIComponent(complexId)}`
      );
    });

    it('properly encodes chunk IDs with special characters in getChunkById', async () => {
      let requestedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return new Response(
          JSON.stringify({ id: 'c-test', code: 'def test(): pass' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const chunkId = 'chunk/with/slashes and spaces';
      await client.getChunkById(chunkId);

      expect(requestedUrl).toBe(
        `http://localhost:8000/api/v1/chunks/${encodeURIComponent(chunkId)}`
      );
    });

    it('normalizes base URL stripping trailing slashes on creation and setter', () => {
      const c = new ApiClient({ baseUrl: 'http://custom-host:9090////' });
      expect(c.getBaseUrl()).toBe('http://custom-host:9090');

      c.setBaseUrl('http://new-host:8080///');
      expect(c.getBaseUrl()).toBe('http://new-host:8080');
    });
  });

  // =========================================================================
  // 3. Error Handling on Non-200 Responses
  // =========================================================================
  describe('3. Robust Error Handling on Non-200 Status Codes', () => {
    it('throws formatted error with FastAPI standard string detail on 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: "Entity 'UnknownService' not found in vector index" }),
          {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(client.lookupEntity('UnknownService')).rejects.toThrow(
        "API Error 404: Entity 'UnknownService' not found in vector index"
      );
    });

    it('demonstrates template interpolation behavior on 422 when detail is an Array/Object', async () => {
      // In FastAPI, validation errors return detail as an Array of objects.
      // Because errJson.detail is an Object, template string `${errJson.detail}` evaluates to [object Object].
      const pydanticError = {
        detail: [
          { loc: ['body', 'query'], msg: 'Field required', type: 'missing' },
        ],
      };
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(pydanticError), {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.search({ query: '' })).rejects.toThrow(
        'API Error 422: [object Object]'
      );
    });

    it('falls back to statusText when 500 server error returns HTML or non-JSON plain text', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<html><body>500 Internal Server Error</body></html>', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/html' },
        })
      );

      await expect(client.getHealth()).rejects.toThrow('API Error 500: Internal Server Error');
    });

    it('handles 502 Bad Gateway / 503 Service Unavailable gracefully without crashing JSON parser', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Bad Gateway', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      await expect(client.search({ query: 'test' })).rejects.toThrow('API Error 502: Bad Gateway');
    });

    it('serializes entire error payload if JSON response has no .detail field', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error_code: 'RATE_LIMIT_EXCEEDED', retry_after: 30 }),
          {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(client.search({ query: 'rate limit query' })).rejects.toThrow(
        'API Error 429: {"error_code":"RATE_LIMIT_EXCEEDED","retry_after":30}'
      );
    });
  });

  // =========================================================================
  // 4. Abort Signals & Timeout Mechanics
  // =========================================================================
  describe('4. Abort Signals & Timeout Mechanics', () => {
    it('aborts active in-flight request when user AbortSignal is triggered', async () => {
      const abortController = new AbortController();

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const searchPromise = client.search(
        { query: 'abort me' },
        { signal: abortController.signal }
      );

      // Trigger user cancellation after brief delay
      setTimeout(() => abortController.abort(), 20);

      await expect(searchPromise).rejects.toThrow(/abort/i);
    });

    it('aborts request when client timeoutMs threshold is exceeded', async () => {
      const shortTimeoutClient = new ApiClient({
        baseUrl: 'http://localhost:8000',
        timeoutMs: 50,
      });

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new Error('The operation timed out');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      await expect(
        shortTimeoutClient.search({ query: 'slow endpoint' })
      ).rejects.toThrow(/abort|timed out/i);
    });

    it('passes signal through searchAstChunks down to lookupEntity and search', async () => {
      const abortController = new AbortController();
      const lookupSpy = vi.spyOn(client, 'lookupEntity').mockResolvedValue({
        identifier: 'Session',
        count: 1,
        chunks: [],
      });

      await client.searchAstChunks('entity:Session', { signal: abortController.signal });

      expect(lookupSpy).toHaveBeenCalledWith('Session', { signal: abortController.signal });
    });

    it('observes behavior when an already aborted signal is passed', async () => {
      // In DOM EventTarget, addEventListener on an already-aborted signal does not fire.
      // ApiClient relies on fetch to handle pre-aborted signal via controller.
      const preAborted = AbortSignal.abort(new Error('Pre-aborted'));
      let receivedSignal: AbortSignal | undefined;

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        receivedSignal = init?.signal as AbortSignal;
        return Promise.resolve(
          new Response(JSON.stringify({ query: 'q', total_results: 0, chunks: [], latency_ms: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      await client.search({ query: 'test' }, { signal: preAborted });
      // Internal controller.signal was passed to fetch
      expect(receivedSignal).toBeDefined();
      expect(preAborted.aborted).toBe(true);
    });
  });

  // =========================================================================
  // 5. useNemoIR Hook Integration & Health Resilience
  // =========================================================================
  describe('5. useNemoIR Hook Invariants & Zero Mock Guarantee', () => {
    it('initializes in ready state and provides working searchAstChunks and lookupEntity', async () => {
      const { result } = renderHook(() => useNemoIR());

      expect(result.current.wasmStatus).toBe('ready');
      expect(result.current.isReady).toBe(true);
      expect(typeof result.current.searchAstChunks).toBe('function');
      expect(typeof result.current.lookupEntity).toBe('function');
    });

    it('initNemo calls apiClient.getHealth and maintains ready state even if health check fails', async () => {
      vi.spyOn(apiClient, 'getHealth').mockRejectedValue(new Error('Backend offline'));

      const { result } = renderHook(() => useNemoIR());

      await act(async () => {
        await result.current.initNemo();
      });

      // Hook handles startup gracefully without setting status to permanent error
      expect(result.current.wasmStatus).toBe('ready');
    });

    it('lookupEntity extracts .chunks array from EntityLookupResponse', async () => {
      const sampleChunks: AstCodeChunk[] = [
        { id: 'chunk-1', identifier: 'TestClass' } as AstCodeChunk,
      ];
      vi.spyOn(apiClient, 'lookupEntity').mockResolvedValue({
        identifier: 'TestClass',
        count: 1,
        chunks: sampleChunks,
      });

      const { result } = renderHook(() => useNemoIR());

      const chunks = await result.current.lookupEntity!('TestClass');
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].identifier).toBe('TestClass');
    });

    it('executeWorkflow returns deterministic workflow signature', async () => {
      const { result } = renderHook(() => useNemoIR());

      const wfResult = (await result.current.executeWorkflow({ test: 123 })) as {
        success: boolean;
        workflow: string;
        output: Record<string, unknown>;
      };

      expect(wfResult.success).toBe(true);
      expect(wfResult.workflow).toBe('.nemo-vector-search-v1');
      expect(wfResult.output).toEqual({ test: 123 });
    });
  });
});
