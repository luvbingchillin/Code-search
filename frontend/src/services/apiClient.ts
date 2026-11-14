/**
 * FastAPI Retrieval Backend Client
 * Connects the frontend Edge AI ReAct loop with the Python FastAPI backend.
 */
import {
  AstCodeChunk,
  AstNodeType,
  NemoSearchOptions,
  RepositoryItem,
  RepositoryTreeResponse,
  RepositoryManifestResponse,
} from '../types';

export interface SearchRequest {
  query: string;
  top_k?: number;
  ast_node_type?: AstNodeType;
  file_path?: string;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  chunks: AstCodeChunk[];
  latency_ms: number;
}

export interface EntityLookupResponse {
  identifier: string;
  count: number;
  chunks: AstCodeChunk[];
}

export interface HealthResponse {
  status: string;
  vector_db: string;
  total_chunks: number;
  embedding_dimension: number;
  embedding_model: string;
}

export interface IndexResponse {
  indexed_files: number;
  extracted_chunks: number;
  elapsed_seconds: number;
}

export interface ApiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class ApiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config?: ApiClientConfig) {
    const envUrl =
      typeof import.meta !== 'undefined' && (import.meta as any).env
        ? ((import.meta as any).env.VITE_API_URL as string | undefined)
        : undefined;
    this.baseUrl = (config?.baseUrl || envUrl || 'http://localhost:8000').replace(/\/+$/, '');
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit & { timeoutMs?: number }
  ): Promise<T> {
    const { timeoutMs = this.timeoutMs, ...fetchOptions } = options || {};
    const controller = new AbortController();
    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      try {
        controller.abort(new DOMException(`Request to ${endpoint} timed out (aborted after ${timeoutMs}ms)`, 'AbortError'));
      } catch {
        controller.abort();
      }
    }, timeoutMs);

    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => {
        try {
          controller.abort(fetchOptions.signal?.reason);
        } catch {
          controller.abort();
        }
      });
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errJson = await response.json();
          errorDetail = errJson.detail || JSON.stringify(errJson);
        } catch {
          // fallback to statusText
        }
        throw new Error(`API Error ${response.status}: ${errorDetail}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || isTimedOut) {
        const defaultMsg = isTimedOut
          ? `Request to ${cleanEndpoint} timed out (aborted after ${timeoutMs}ms)`
          : 'The operation was aborted';
        const rawReason = controller.signal?.reason;
        const reasonMsg =
          typeof rawReason === 'string'
            ? rawReason
            : rawReason?.message || err?.message;

        const finalMsg =
          reasonMsg && !reasonMsg.includes('without reason')
            ? reasonMsg
            : defaultMsg;

        const normalizedError = new DOMException(finalMsg, isTimedOut ? 'TimeoutError' : 'AbortError');
        throw normalizedError;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async getHealth(options?: { signal?: AbortSignal }): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/v1/health', {
      method: 'GET',
      signal: options?.signal,
    });
  }

  public async search(
    request: SearchRequest,
    options?: { signal?: AbortSignal }
  ): Promise<SearchResponse> {
    return this.request<SearchResponse>('/api/v1/search', {
      method: 'POST',
      body: JSON.stringify(request),
      signal: options?.signal,
    });
  }

  public async indexRepository(
    sourceDir: string,
    options?: { forceReindex?: boolean; signal?: AbortSignal; timeoutMs?: number }
  ): Promise<IndexResponse> {
    return this.request<IndexResponse>('/api/v1/index', {
      method: 'POST',
      body: JSON.stringify({
        source_dir: sourceDir,
        force_reindex: options?.forceReindex ?? false,
      }),
      signal: options?.signal,
      timeoutMs: options?.timeoutMs ?? 60000,
    });
  }

  public async lookupEntity(
    identifier: string,
    options?: { signal?: AbortSignal }
  ): Promise<EntityLookupResponse> {
    const encoded = encodeURIComponent(identifier);
    return this.request<EntityLookupResponse>(`/api/v1/entity/${encoded}`, {
      method: 'GET',
      signal: options?.signal,
    });
  }

  public async getChunkById(
    id: string,
    options?: { signal?: AbortSignal }
  ): Promise<AstCodeChunk> {
    const encoded = encodeURIComponent(id);
    return this.request<AstCodeChunk>(`/api/v1/chunks/${encoded}`, {
      method: 'GET',
      signal: options?.signal,
    });
  }

  /**
   * High-level routing method for useNemoIR:
   * Dispatches between exact-match entity lookup and semantic vector search.
   */
  public async searchAstChunks(
    query: string,
    options?: NemoSearchOptions & { signal?: AbortSignal }
  ): Promise<AstCodeChunk[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const isExplicitExact = options?.searchType === 'exact' || options?.exactMatch === true;
    const isEntityPrefix = trimmed.startsWith('entity:') || trimmed.startsWith('exact:');
    const entityTarget = isEntityPrefix
      ? trimmed.replace(/^(entity:|exact:)\s*/, '')
      : options?.filters?.identifier || options?.identifier;

    if (isExplicitExact || isEntityPrefix || options?.filters?.identifier || options?.identifier) {
      const target = entityTarget || trimmed;
      const response = await this.lookupEntity(target, { signal: options?.signal });
      let chunks = response.chunks || [];
      if (options?.topK && options.topK > 0) {
        chunks = chunks.slice(0, options.topK);
      }
      return chunks;
    }

    const response = await this.search(
      {
        query: trimmed,
        top_k: options?.topK ?? 5,
        ast_node_type: options?.filters?.astNodeType,
        file_path: options?.filters?.filePath || options?.filePath,
      },
      { signal: options?.signal }
    );

    return response.chunks || [];
  }

  public async getRepositories(): Promise<RepositoryItem[]> {
    try {
      const resp = await this.request<{ repositories: RepositoryItem[]; total: number }>('/api/v1/repos');
      return resp.repositories.map((r: RepositoryItem) => ({
        ...r,
        chunksCount: r.chunks_count ?? r.chunksCount ?? 0,
        filesCount: r.files_count ?? r.filesCount ?? 0,
      }));
    } catch {
      return [
        {
          id: 'requests',
          name: 'psf/requests',
          path: 'fixtures/requests',
          chunksCount: 284,
          filesCount: 17,
          status: 'indexed',
          description: 'Python HTTP for Humans (284 AST nodes, Session, models, adapters)',
        },
        {
          id: 'sample_codebase',
          name: 'sample_codebase',
          path: 'backend/sample_codebase',
          chunksCount: 14,
          filesCount: 3,
          status: 'indexed',
          description: 'FastAPI service sample with math functions, classes, and decorators',
        },
      ];
    }
  }

  public async getRepoChunks(repoIdOrPath: string, limit: number = 10): Promise<AstCodeChunk[]> {
    try {
      return await this.request<AstCodeChunk[]>(
        `/api/v1/repos/${encodeURIComponent(repoIdOrPath)}/chunks?limit=${limit}`
      );
    } catch {
      return [];
    }
  }

  public async getRepoTree(repoId: string): Promise<RepositoryTreeResponse | null> {
    try {
      return await this.request<RepositoryTreeResponse>(
        `/api/v1/repos/${encodeURIComponent(repoId)}/tree`
      );
    } catch {
      return null;
    }
  }

  public async getRepoManifest(
    repoId: string,
    options?: { signal?: AbortSignal }
  ): Promise<RepositoryManifestResponse | null> {
    try {
      return await this.request<RepositoryManifestResponse>(
        `/api/v1/repos/${encodeURIComponent(repoId)}/manifest`,
        { method: 'GET', signal: options?.signal }
      );
    } catch {
      // Fallback if backend offline or endpoint unavailable
      if (repoId.toLowerCase().includes('requests')) {
        return {
          repo_id: 'requests',
          repo_name: 'psf/requests',
          manifest:
            'psf/requests is a human-friendly HTTP client library for Python.\n' +
            'Core Components:\n' +
            '- Session: Maintains cookies, connection pooling, and configuration across requests.\n' +
            '- Request & PreparedRequest: Represents outgoing HTTP requests before and after URL/header preparation.\n' +
            '- Response: Encapsulates server response data, status codes, encoding detection, and JSON parsing.\n' +
            '- HTTPAdapter: Transport adapter connecting Sessions to urllib3 socket pools.\n' +
            'Pipeline: Session.request() builds Request -> prepares PreparedRequest -> dispatches via HTTPAdapter.send() -> returns Response.',
          core_components: ['Session', 'Request', 'PreparedRequest', 'Response', 'HTTPAdapter'],
        };
      } else if (repoId.toLowerCase().includes('sample')) {
        return {
          repo_id: 'sample_codebase',
          repo_name: 'sample_codebase',
          manifest:
            'sample_codebase is a demonstration service showcasing FastAPI routes, mathematical operations, and utility classes.\n' +
            'Core Components:\n' +
            '- Calculator: Core calculation class supporting arithmetic operations, memory storage, and error handling.\n' +
            '- FastAPI Routes: API endpoints exposing calculation services and health checks.\n' +
            '- Utility Functions: Helper validation and formatting routines.\n' +
            'Pipeline: Client request -> FastAPI route validation -> Calculator business logic execution -> JSON response.',
          core_components: ['Calculator', 'FastAPI Routes', 'Utility Functions'],
        };
      }
      return null;
    }
  }
}

export const apiClient = new ApiClient();
