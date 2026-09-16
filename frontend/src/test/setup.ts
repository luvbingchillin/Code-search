import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// Polyfill fetch for Node/JSDOM to support file: and .wasm URLs natively for @nemoir/compiler-wasm
const origFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input as any)?.url || (input as any)?.href || String(input);
  if (typeof url === 'string' && (url.startsWith('file:') || url.endsWith('.wasm'))) {
    const filePath = url.startsWith('file:') ? fileURLToPath(url) : url;
    const buf = fs.readFileSync(filePath);
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': 'application/wasm' },
    });
  }
  return origFetch(input, init);
};

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


