// src/test/setup.js
import "@testing-library/jest-dom/vitest";

// Stub localStorage for tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Stub import.meta.env for API client
globalThis.__APP_VERSION__ = "test";

// Reset localStorage between tests
afterEach(() => {
  localStorage.clear();
});
