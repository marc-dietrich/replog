// src/__tests__/setup.js
//
// Vitest setup — runs before each test file.
// - Extends expect with jest-dom matchers (toBeInTheDocument, etc.)
// - Mocks virtual:app-config globally

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock the Vite virtual module so all hooks can import config
vi.mock("virtual:app-config", () => ({
  default: {
    apiBase: "/api",
    sync: {
      maxRetries: 10,
      baseDelayMs: 2000,
      maxDelayMs: 300_000,
      retryIntervalMs: 30_000,
    },
    health: {
      cacheMs: 5000,
      fetchTimeoutMs: 3000,
      pollIntervalMs: 30_000,
    },
    entries: {
      defaultLimit: 10,
      loadMoreLimit: 200,
    },
    storage: {
      settingsKey: "replog-ui-settings",
    },
  },
}));
