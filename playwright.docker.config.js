// playwright.docker.config.js
//
// Playwright config for e2e tests against the Docker Compose setup.
// Run with: npx playwright test --config=playwright.docker.config.js
//
// Prerequisites: docker compose up -d (all services running)

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./e2e/global-setup.js",
  testDir: "./e2e",
  testMatch: "**/full-flow.spec.js",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "html",
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
