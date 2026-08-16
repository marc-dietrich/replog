// e2e/full-flow.spec.js
//
// Full end-to-end test for simple session-based auth + server-first CRUD.
//
// Covers:
//   Phase 1 – Register a new user, verify data loads empty
//   Phase 2 – Create groups + exercises, verify they persist
//   Phase 3 – Refresh: data loads from server
//   Phase 4 – Delete an exercise
//   Phase 5 – Logout and re-login, data persists
//   Phase 6 – Login with pre-existing test user (from global-setup)
//
// Requires Docker Compose running: docker compose up -d
// Run: npm run test:e2e:docker

import { test, expect } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME || "e2e-testuser";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-testpass";

// ── Helpers ────────────────────────────────────────────────────────────────

async function openSettings(page) {
  await page.locator(".app-settings-btn").click();
  await page.waitForSelector(".app-settings-menu", { timeout: 5_000 });
}

async function closeSettings(page) {
  await page.locator(".app-settings-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".app-settings-menu")).not.toBeVisible({ timeout: 5_000 });
}

async function openAuthDialog(page) {
  // FAB appears ~5s after page load when logged out
  await page.waitForSelector(".app-account-fab", { timeout: 10_000 });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForSelector(".login-dialog", { timeout: 10_000 });
}

async function register(page, username, password) {
  await openAuthDialog(page);
  await page.locator(".login-dialog__tab").filter({ hasText: "Register" }).click();
  await page.locator(".login-dialog__input").nth(0).fill(username);
  await page.locator(".login-dialog__input").nth(1).fill(password);
  await page.locator(".login-dialog__input").nth(2).fill(password);
  await page.locator(".login-dialog__submit").click();
  await page.waitForSelector(".login-dialog", { state: "detached", timeout: 15_000 });
}

async function login(page, username, password) {
  await openAuthDialog(page);
  await page.locator(".login-dialog__input").nth(0).fill(username);
  await page.locator(".login-dialog__input").nth(1).fill(password);
  await page.locator(".login-dialog__submit").click();
  await page.waitForSelector(".login-dialog", { state: "detached", timeout: 15_000 });
}

async function logout(page) {
  await openSettings(page);
  await page.locator(".app-settings-signout-btn").click();
  // fully synced queue → logout runs without confirmation dialog;
  // the login FAB reappears once signed out
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
  await closeSettings(page);
}

async function expectSignedIn(page) {
  await openSettings(page);
  await expect(page.locator(".app-settings-signout-btn")).toBeVisible({ timeout: 10_000 });
  await closeSettings(page);
}

async function openAddPanel(page, type) {
  await page.locator(".app-add-switch__btn").filter({ hasText: type }).click();
  await expect(page.locator(".add-panel")).toBeVisible({ timeout: 5_000 });
}

async function addViaPanel(page, name) {
  await page.locator(".add-name-form__input").fill(name);
  await page.locator(".add-name-form__confirm").click();
  await expect(page.locator(".add-panel")).not.toBeVisible({ timeout: 10_000 });
}

async function addGroup(page, name) {
  await openAddPanel(page, "Group");
  await addViaPanel(page, name);
}

async function addExercise(page, name) {
  await openAddPanel(page, "Exercise");
  await addViaPanel(page, name);
}

async function assertExerciseVisible(page, name) {
  await expect(page.locator(".exercise-item__title", { hasText: name })).toBeVisible({
    timeout: 10_000,
  });
}

async function waitForApp(page) {
  await page.waitForSelector(".app-header", { timeout: 10_000 });
}

// ── Test ───────────────────────────────────────────────────────────────────

test.describe("Simple auth + server-first CRUD lifecycle", () => {
  test.describe.configure({ timeout: 180_000 });

  test("complete sequential flow", async ({ page, context }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const uniqueSuffix = Date.now();
    const uniqueUser = `${USERNAME}-${uniqueSuffix}`;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1 — Register a new user
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 1: register new user, verify empty data", async () => {
      await context.clearCookies();
      await page.goto("/");
      await waitForApp(page);

      await register(page, uniqueUser, PASSWORD);
      await expectSignedIn(page);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2 — Create groups + exercises
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 2: create groups and exercises", async () => {
      await addGroup(page, "Legs");
      await addExercise(page, "Squat");
      await addExercise(page, "Deadlift");

      await addGroup(page, "Upper Body");
      await addExercise(page, "Bench Press");
      await addExercise(page, "Overhead Press");

      await assertExerciseVisible(page, "Squat");
      await assertExerciseVisible(page, "Deadlift");
      await assertExerciseVisible(page, "Bench Press");
      await assertExerciseVisible(page, "Overhead Press");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3 — Refresh: data persists from server
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 3: refresh — data loads from server", async () => {
      await page.reload();
      await waitForApp(page);
      await expectSignedIn(page);

      await assertExerciseVisible(page, "Squat");
      await assertExerciseVisible(page, "Bench Press");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4 — Delete an exercise
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 4: delete exercise", async () => {
      const firstExercise = page.locator(".exercise-item").first();
      const deleteBtn = firstExercise.locator("button").filter({ has: page.locator("span.material-icons-round") }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(1500);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5 — Logout then re-login: data persists
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 5: logout and re-login — data persists", async () => {
      await logout(page);

      await login(page, uniqueUser, PASSWORD);
      await expectSignedIn(page);

      await assertExerciseVisible(page, "Squat");
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 6 — Login with pre-existing test user
    // ═══════════════════════════════════════════════════════════════════════
    await test.step("Phase 6: login with pre-existing user", async () => {
      await logout(page);
      await login(page, USERNAME, PASSWORD);
      await expectSignedIn(page);
    });

    if (pageErrors.length > 0) {
      console.log("[test] Browser console errors:", pageErrors);
    }
  });
});
