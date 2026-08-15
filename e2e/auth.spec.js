// e2e/auth.spec.js
//
// Auth flow tests — the header account icon opens the login/register dialog.

import { test, expect } from "@playwright/test";

async function openAuthDialog(page) {
  // FAB appears ~5s after page load when logged out
  await page.waitForSelector(".app-account-fab", { timeout: 10_000 });
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".login-dialog")).toBeVisible();
}

test.describe("Auth flow", () => {
  test("header account icon opens the login/register dialog", async ({ page }) => {
    await page.goto("/");

    await openAuthDialog(page);
    await expect(page.locator(".login-dialog__tab").filter({ hasText: "Login" })).toBeVisible();
    await expect(page.locator(".login-dialog__tab").filter({ hasText: "Register" })).toBeVisible();
  });

  test("can switch between login and register tabs", async ({ page }) => {
    await page.goto("/");

    await openAuthDialog(page);

    // Default: login tab
    await expect(page.locator(".login-dialog__tab--active")).toContainText("Login");

    // Switch to register — should show confirm password field
    await page.locator(".login-dialog__tab").filter({ hasText: "Register" }).click();
    const inputs = page.locator(".login-dialog__input");
    await expect(inputs).toHaveCount(3); // username, password, confirm password

    // Switch back to login
    await page.locator(".login-dialog__tab").filter({ hasText: "Login" }).click();
    await expect(page.locator(".login-dialog__input")).toHaveCount(2);
  });

  test("dialog can be closed again", async ({ page }) => {
    await page.goto("/");

    await openAuthDialog(page);
    await page.locator(".login-dialog__close").click();
    await expect(page.locator(".login-dialog")).not.toBeVisible();
  });

  test("app shows content without login — no auth form in the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-header")).toBeVisible();
    await expect(page.locator(".app-section-head__label")).toHaveText("Your Exercises");
    await expect(page.locator(".login-dialog")).not.toBeVisible();
  });
});
