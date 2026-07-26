// e2e/global-setup.js
//
// Playwright global setup — auto-creates a Keycloak test user
// so no manual prep is needed before running e2e tests.
//
// Uses Keycloak Admin REST API (admin/admin on localhost:8085).

const KEYCLOAK_BASE = "http://localhost:8085/auth";
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin";
const TEST_USER = "e2e-testuser";
const TEST_PASS = "e2e-testpass";
const REALM = "replog";

async function getAdminToken() {
  const res = await fetch(
    `${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: ADMIN_USER,
        password: ADMIN_PASS,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Keycloak admin login failed: ${res.status} — is Docker running?`
    );
  }
  const data = await res.json();
  return data.access_token;
}

async function userExists(token, username) {
  const res = await fetch(
    `${KEYCLOAK_BASE}/admin/realms/${REALM}/users?username=${username}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const users = await res.json();
  return users.length > 0;
}

async function createUser(token, username, password) {
  // Create the user
  const createRes = await fetch(
    `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        email: `${username}@e2e.test`,
        emailVerified: true,
        enabled: true,
        firstName: "E2E",
        lastName: "Test",
      }),
    }
  );

  if (createRes.status !== 201) {
    const body = await createRes.text();
    throw new Error(`Failed to create user: ${createRes.status} ${body}`);
  }

  // Get the user ID from the Location header
  const userId = createRes.headers
    .get("location")
    ?.split("/")
    .pop();

  if (!userId) throw new Error("Could not extract user ID from response");

  // Set the password
  const pwdRes = await fetch(
    `${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${userId}/reset-password`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "password",
        value: password,
        temporary: false,
      }),
    }
  );

  if (pwdRes.status !== 204) {
    throw new Error(`Failed to set password: ${pwdRes.status}`);
  }
}

export default async function globalSetup() {
  console.log("[setup] Ensuring Keycloak test user exists...");

  let token;
  for (let i = 0; i < 10; i++) {
    try {
      token = await getAdminToken();
      break;
    } catch {
      console.log(`[setup] Waiting for Keycloak (attempt ${i + 1}/10)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!token) throw new Error("Keycloak not reachable after 10 attempts");

  const exists = await userExists(token, TEST_USER);
  if (!exists) {
    await createUser(token, TEST_USER, TEST_PASS);
    console.log(`[setup] Created test user: ${TEST_USER}`);
  } else {
    console.log(`[setup] Test user already exists: ${TEST_USER}`);
  }

  // Expose credentials to tests
  process.env.E2E_USERNAME = TEST_USER;
  process.env.E2E_PASSWORD = TEST_PASS;
}
