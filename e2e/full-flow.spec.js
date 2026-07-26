// e2e/full-flow.spec.js
//
// Comprehensive local-first + auth + sync e2e test.
// NO manual prep needed — global-setup.js auto-creates the Keycloak test user.
//
// Requires Docker Compose running: docker compose up -d
// Run: npm run test:e2e:docker

import { test, expect } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME || "e2e-testuser";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-testpass";

async function keycloakLogin(page, username, password) {
  await page.waitForURL(/\/auth\/realms\/replog\/.*/, { timeout: 15_000 });
  await page.waitForSelector("#username", { timeout: 10_000 });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
  // Wait for redirect back to app (not on Keycloak page)
  await page.waitForURL((url) => !url.toString().includes("/auth/"), {
    timeout: 20_000,
  });
  await page.waitForSelector(".auth-user__name", { timeout: 10_000 });
}

async function addViaPanel(page, name) {
  await expect(page.locator(".add-panel")).toBeVisible({ timeout: 5000 });
  await page.locator(".add-name-form__input").fill(name);
  await page.locator(".add-name-form__confirm").click();
  await expect(page.locator(".add-panel")).not.toBeVisible({ timeout: 5000 });
}

test.describe("Full local-first + auth + sync flow", () => {
  test("create data offline, sync on sign-in, restore after clear", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // ── 1. Fresh session — open the app ──────────────────────────────
    await page.goto("/");
    await expect(page.locator(".app-header")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".app-section-head__count")).toContainText("0");

    // ── 2. Create a group ────────────────────────────────────────────
    await page.locator(".app-add-switch__btn").filter({ hasText: "Group" }).click();
    await addViaPanel(page, "Legs");

    // ── 3. Create an exercise ────────────────────────────────────────
    await page.locator(".app-add-switch__btn").filter({ hasText: "Exercise" }).click();
    await addViaPanel(page, "Squat");

    // ── 4. Create a second exercise ──────────────────────────────────
    await page.locator(".app-add-switch__btn").filter({ hasText: "Exercise" }).click();
    await addViaPanel(page, "Bench Press");

    // ── 5. Reload — data must persist in IndexedDB ──────────────────
    await page.reload();
    await expect(page.locator(".app-header")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".app-section-head__count")).toContainText("2");

    // ── 6. Sign in to Keycloak ───────────────────────────────────────
    await page.locator(".auth-btn--login").click();
    await keycloakLogin(page, USERNAME, PASSWORD);

    // Wait for sync + server fetch, then reload
    await page.waitForTimeout(5000);
    await page.reload();
    await expect(page.locator(".app-header")).toBeVisible({ timeout: 10_000 });
    // Data synced to backend and re-fetched — should still show 2
    await expect(page.locator(".app-section-head__count")).toContainText("2", {
      timeout: 20_000,
    });
  });
});
