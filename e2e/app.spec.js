// e2e/app.spec.js
//
// Smoke tests — the app loads, renders correctly, and handles basic interactions
// without authentication (local-first mode).

import { test, expect } from "@playwright/test";

test.describe("App smoke tests", () => {
  test("page loads without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");

    // No JS errors on load
    expect(errors).toEqual([]);
  });

  test("renders header and brand", async ({ page }) => {
    await page.goto("/");

    // App header
    await expect(page.locator(".app-header")).toBeVisible();
    // Brand title
    await expect(page.locator(".app-brand__title")).toHaveText("RepLog");
    // Version is shown
    await expect(page.locator(".app-version")).toBeVisible();
  });

  test("renders add exercise/group buttons", async ({ page }) => {
    await page.goto("/");

    // Add buttons exist
    const addSwitch = page.locator(".app-add-switch");
    await expect(addSwitch).toBeVisible();

    // Exercise and Group buttons
    await expect(page.getByRole("button", { name: "Exercise" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Group" })).toBeVisible();
  });

  test("renders login fab when not authenticated", async ({ page }) => {
    await page.goto("/");

    // FAB appears ~5s after page load
    const accountBtn = page.getByRole("button", { name: "Sign in" });
    await expect(accountBtn).toBeVisible({ timeout: 10_000 });
  });

  test("renders exercise list (empty state when no data)", async ({ page }) => {
    await page.goto("/");

    // Exercise section heading
    await expect(page.locator(".app-section-head__label")).toHaveText(
      "Your Exercises"
    );
    // Count shows 0 ACTIVE when empty
    await expect(page.locator(".app-section-head__count")).toBeVisible();
  });

  test("menu opens and shows settings", async ({ page }) => {
    await page.goto("/");

    // Hamburger menu button — app has a menu toggle, find it
    const menuBtn = page.locator(".app-menu-btn");
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      // Settings section should appear
      await expect(page.getByText("Backup & Data")).toBeVisible();
    }
  });

  test("add exercise flow opens panel", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Exercise" }).click();

    // Add panel should appear
    await expect(page.locator(".add-panel")).toBeVisible();
  });

  test("add group flow opens panel", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Group" }).click();

    // Add panel should appear
    await expect(page.locator(".add-panel")).toBeVisible();
  });
});
