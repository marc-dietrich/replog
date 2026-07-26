// src/auth/keycloak.js
//
// Keycloak client singleton. Initializes on first import and exposes
// the authenticated Keycloak instance plus helper functions.

import Keycloak from "keycloak-js";
import config from "virtual:app-config";

const { url, realm, clientId } = config.keycloak;
const keycloakUrl = url || window.location.origin + "/auth";

const keycloak = new Keycloak({ url: keycloakUrl, realm, clientId });

// ── Init (called once on app startup) ──────────────────────────────────

let initPromise = null;
const INIT_TIMEOUT_MS = 5000;

export function initKeycloak() {
  if (initPromise) return initPromise;

  const init = keycloak.init({
    onLoad: "check-sso",
    silentCheckSsoRedirectUri:
      window.location.origin + "/silent-check-sso.html",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });

  // Wrap with timeout — if Keycloak is unreachable, don't block the app
  const timeout = new Promise((resolve) =>
    setTimeout(() => {
      console.warn("[auth] Keycloak init timed out — continuing without auth");
      resolve(false);
    }, INIT_TIMEOUT_MS)
  );

  initPromise = Promise.race([init, timeout])
    .then((authenticated) => {
      if (authenticated) {
        console.log("[auth] Authenticated as", keycloak.tokenParsed?.preferred_username);
        setupTokenRefresh();
      } else {
        console.log("[auth] Not authenticated");
      }
      return keycloak;
    })
    .catch((err) => {
      console.error("[auth] Init failed:", err);
      return keycloak;
    });

  return initPromise;
}

// ── Token refresh ──────────────────────────────────────────────────────

function setupTokenRefresh() {
  // Automatically refresh the token before it expires
  keycloak.onTokenExpired = () => {
    keycloak.updateToken(30).catch(() => {
      console.warn("[auth] Token refresh failed, logging out");
      keycloak.logout();
    });
  };
}

// ── Public API ─────────────────────────────────────────────────────────

export function login() {
  return keycloak.login();
}

export function logout() {
  return keycloak.logout();
}

export function getToken() {
  return keycloak.token ?? null;
}

export function isAuthenticated() {
  return keycloak.authenticated ?? false;
}

export function getUserInfo() {
  if (!keycloak.tokenParsed) return null;
  return {
    username: keycloak.tokenParsed.preferred_username ?? "unknown",
    name: keycloak.tokenParsed.name ?? keycloak.tokenParsed.preferred_username ?? "unknown",
    email: keycloak.tokenParsed.email ?? null,
    sub: keycloak.tokenParsed.sub,
  };
}

export default keycloak;
