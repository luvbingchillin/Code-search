/**
 * FastAPI Retrieval Backend Client
 * Connects the frontend Edge AI ReAct loop with the Python FastAPI backend.
 */
import { AstCodeChunk, AstNodeType, NemoSearchOptions } from '../types';

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
    this.timeoutMs = config?.timeoutMs ?? 10000;
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
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
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
}

export const apiClient = new ApiClient();
