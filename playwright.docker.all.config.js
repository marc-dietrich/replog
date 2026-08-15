// playwright.docker.all.config.js
//
// Playwright config to run ALL e2e specs against the Docker Compose setup
// (not just the full flow). Prerequisites: docker compose up -d.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./e2e/global-setup.js",
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:8082",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
