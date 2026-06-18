import ElementPlus from "element-plus";
import { config, flushPromises } from "@vue/test-utils";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import { clearAuthSession } from "@/lib/auth-session";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

beforeAll(() => {
  config.global.plugins = [ElementPlus];
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock
  });
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn()
  });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    value: vi.fn()
  });
  const localStorageMock = createStorageMock();
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: localStorageMock
  });
  Object.defineProperty(globalThis, "localStorage", {
    writable: true,
    value: localStorageMock
  });
});

beforeEach(() => {
  window.localStorage.clear();
  clearAuthSession();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  await flushPromises();
});
