import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mockAstChunks } from '../services/mockAstData';

// Fallback window stub to prevent React 19 ReferenceError: window is not defined during asynchronous teardown
const fallbackWindow: any = {
  event: undefined,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
};

if (typeof (globalThis as any).window !== 'undefined') {
  let currentWindow = (globalThis as any).window;
  try {
    Object.defineProperty(globalThis, 'window', {
      get() {
        return currentWindow || fallbackWindow;
      },
      set(v) {
        currentWindow = v;
      },
      configurable: true,
    });
  } catch (e) {
    // ignore if property cannot be redefined
  }
}

afterEach(() => {
  cleanup();
});

// Polyfill ResizeObserver for react-resizable-panels in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).ResizeObserver = ResizeObserverMock;
(globalThis as any).ResizeObserver = ResizeObserverMock;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill HTMLElement.prototype.scrollIntoView for JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Intercept Object.defineProperty for navigator.clipboard so userEvent can attach its stubs safely
const originalDefineProperty = Object.defineProperty;
const writeTextGlobalSpy = vi.fn().mockResolvedValue(undefined);

(Object as any).defineProperty = function (obj: any, prop: any, descriptor: any) {
  if (typeof window !== 'undefined' && window && obj === window.navigator && prop === 'clipboard') {
    if (descriptor.get) {
      const origGet = descriptor.get;
      descriptor.get = () => {
        const stub = origGet();
        if (stub && !vi.isMockFunction(stub.writeText)) {
          vi.spyOn(stub, 'writeText');
        }
        return stub;
      };
    } else if (descriptor.value) {
      if (descriptor.value && !vi.isMockFunction(descriptor.value.writeText)) {
        vi.spyOn(descriptor.value, 'writeText');
      }
    }
    descriptor.configurable = true;
  }
  return originalDefineProperty.call(Object, obj, prop, descriptor);
};

// Initial clipboard stub with configurable: true
Object.defineProperty(window.navigator, 'clipboard', {
  value: {
    writeText: writeTextGlobalSpy,
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
  configurable: true,
});

// Mock navigator.gpu
Object.defineProperty(navigator, 'gpu', {
  value: {
    requestAdapter: vi.fn().mockResolvedValue({
      requestDevice: vi.fn().mockResolvedValue({}),
    }),
  },
  writable: true,
  configurable: true,
});

// Polyfill fetch for Node/JSDOM to support file: and .wasm URLs natively for @nemoir/compiler-wasm,
// as well as offline interception for /api/v1/ backend retrieval endpoints.
const origFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input as any)?.url || (input as any)?.href || String(input);
  if (typeof url === 'string') {
    if (url.startsWith('file:') || url.endsWith('.wasm')) {
      const filePath = url.startsWith('file:') ? fileURLToPath(url) : url;
      const buf = fs.readFileSync(filePath);
      return new Response(buf, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      });
    }

    if (url.includes('/api/v1/health')) {
      const data = {
        status: 'healthy',
        vector_db: 'lancedb',
        total_chunks: mockAstChunks.length,
        embedding_dimension: 384,
        embedding_model: 'all-MiniLM-L6-v2',
      };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/v1/search')) {
      let reqQuery = '';
      let topK = 5;
      if (init?.body && typeof init.body === 'string') {
        try {
          const bodyJson = JSON.parse(init.body);
          reqQuery = bodyJson.query || '';
          topK = bodyJson.top_k || 5;
        } catch {
          // ignore
        }
      }
      const data = {
        query: reqQuery || 'mock query',
        total_results: mockAstChunks.length,
        chunks: mockAstChunks.slice(0, topK),
        latency_ms: 12,
      };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/v1/entity/')) {
      const rawIdentifier = decodeURIComponent(url.split('/api/v1/entity/')[1]?.split('?')[0] || '');
      const filtered = mockAstChunks.filter(
        (c) =>
          c.identifier.toLowerCase() === rawIdentifier.toLowerCase() ||
          c.identifier.toLowerCase().includes(rawIdentifier.toLowerCase())
      );
      const data = {
        identifier: rawIdentifier,
        count: filtered.length,
        chunks: filtered.length > 0 ? filtered : mockAstChunks.slice(0, 1),
      };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/v1/chunks/')) {
      const chunkId = decodeURIComponent(url.split('/api/v1/chunks/')[1]?.split('?')[0] || '');
      const chunk = mockAstChunks.find((c) => c.id === chunkId) || mockAstChunks[0];
      return new Response(JSON.stringify(chunk), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return origFetch ? origFetch(input, init) : new Response('Not Found', { status: 404 });
};

if (typeof window !== 'undefined') {
  (window as any).fetch = globalThis.fetch;
}

// Polyfill Worker for JSDOM
if (typeof (globalThis as any).Worker === 'undefined' || typeof (window as any).Worker === 'undefined') {
  class WorkerMock {
    onmessage: ((ev: any) => void) | null = null;
    onerror: ((ev: any) => void) | null = null;
    postMessage(_msg: any) {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  }
  (window as any).Worker = WorkerMock;
  (globalThis as any).Worker = WorkerMock;
}


