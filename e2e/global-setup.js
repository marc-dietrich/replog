// e2e/global-setup.js
//
// Playwright global setup for simple session-based auth.
// No Keycloak — registers a test user via the app's own API.

const API_BASE = "http://localhost:8082/api";
const TEST_USER = "e2e-testuser";
const TEST_PASS = "e2e-testpass";

async function globalSetup() {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }),
    });
    if (res.ok || res.status === 400) {
      console.log("[global-setup] Test user ready");
    } else {
      console.warn(`[global-setup] Unexpected status: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[global-setup] Could not reach backend: ${err.message}`);
  }
}

export default globalSetup;
