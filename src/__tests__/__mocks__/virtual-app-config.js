// src/__tests__/__mocks__/virtual-app-config.js
//
// Mock for virtual:app-config used in tests.
// Mirrors the shape of src/config.defaults.js

const mockConfig = {
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
};

export default mockConfig;
