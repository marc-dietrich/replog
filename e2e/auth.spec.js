// e2e/auth.spec.js
//
// Auth flow tests — login/register form, logout behaviour.

import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("login/register form is visible when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".auth-form")).toBeVisible();
    await expect(page.locator(".auth-form__tab").filter({ hasText: "Login" })).toBeVisible();
    await expect(page.locator(".auth-form__tab").filter({ hasText: "Register" })).toBeVisible();
  });

  test("can switch between login and register tabs", async ({ page }) => {
    await page.goto("/");

    // Default: login tab
    await expect(page.locator(".auth-form__tab--active")).toContainText("Login");

    // Switch to register — should show confirm password field
    await page.locator(".auth-form__tab").filter({ hasText: "Register" }).click();
    const inputs = page.locator(".auth-form__input");
    await expect(inputs).toHaveCount(3); // username, password, confirm password

    // Switch back to login
    await page.locator(".auth-form__tab").filter({ hasText: "Login" }).click();
    await expect(page.locator(".auth-form__input")).toHaveCount(2);
  });

  test("app shows form when not logged in", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-header")).toBeVisible();
    await expect(page.locator(".auth-form")).toBeVisible();
  });
});
