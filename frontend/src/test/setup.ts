import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

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

