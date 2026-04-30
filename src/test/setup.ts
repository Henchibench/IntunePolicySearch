import '@testing-library/jest-dom/vitest';

// Node 24 ships a built-in localStorage that is not a full Web Storage API.
// Override it with jsdom's window.localStorage so tests that call setItem/clear work.
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  globalThis.localStorage = window.localStorage;
}

// jsdom does not implement these browser APIs that Radix/cmdk components rely on.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
