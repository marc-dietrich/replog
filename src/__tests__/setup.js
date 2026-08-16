// src/__tests__/setup.js
//
// Vitest setup — runs before each test file.
// - Extends expect with jest-dom matchers (toBeInTheDocument, etc.)
// - Mocks virtual:app-config globally

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// IndexedDB is not available in jsdom — Dexie needs the in-memory shim.
import "fake-indexeddb/auto";

// Reset the Dexie DB between test files so data never leaks across suites.
import { db } from "../db/db";
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// Mock the Vite virtual module so all hooks can import config
vi.mock("virtual:app-config", () => ({
  default: {
    apiBase: "/api",
    sync: {
      maxRetries: 100,
      logoutPushTimeoutMs: 2500,
      requestTimeoutMs: 20000,
    },
    health: {
      cacheMs: 5000,
      fetchTimeoutMs: 3000,
      pollIntervalMs: 30_000,
    },
    entries: {
      defaultLimit: 10,
      capLimit: 10,
      loadMoreLimit: 200,
    },
    storage: {
      settingsKey: "replog-ui-settings",
    },
  },
}));
