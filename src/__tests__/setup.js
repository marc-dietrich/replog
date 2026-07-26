// src/__tests__/setup.js
//
// Vitest setup — runs before each test file.
// - Extends expect with jest-dom matchers (toBeInTheDocument, etc.)
// - Mocks IndexedDB with fake-indexeddb so Dexie works in Node

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
