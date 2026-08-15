// src/auth/AuthContext.jsx
//
// Session auth (username+password, session cookie) explicitly wired to
// the sync engine (F5): login / register / claim / session-restore all
// trigger the full push→pull login flow; logout runs the 3.3 sequence
// (final push attempt → leftover check → confirm → clear cache+queue).

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import config from "virtual:app-config";
import { clearAll, loginFlow, openOpCount, processQueue } from "../db/sync";

const { apiBase, sync: syncCfg } = config;

const AuthContext = createContext(null);

/**
 * Extracts a human-readable error message from a JSON error response body.
 * The backend returns { "error": "some message" } — we only want the value.
 */
function extractErrorMessage(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed.error || null;
  } catch {
    return text; // not JSON, use as-is
  }
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Session restore on mount counts as a full login (G2): push + pull.
  useEffect(() => {
    fetch(`${apiBase}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        setAuthenticated(true);
        setUser({ id: data.id, username: data.username });
        loginFlow().catch((err) => console.error("[sync] login flow failed:", err));
      })
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username, password) => {
    setError(null);
    const res = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const message = extractErrorMessage(text) || "Login failed";
      throw new Error(message);
    }
    const data = await res.json();
    setAuthenticated(true);
    setUser({ id: data.id, username: data.username });
    // 3.2: push the queue first, then pull — async, must not block the UI.
    loginFlow().catch((err) => console.error("[sync] login flow failed:", err));
  }, []);

  const register = useCallback(async (username, password) => {
    setError(null);
    const res = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const message = extractErrorMessage(text) || "Registration failed";
      throw new Error(message);
    }
    const data = await res.json();
    setAuthenticated(true);
    setUser({ id: data.id, username: data.username });
    // 3.4: existing queue is pushed to the new account, then pull.
    loginFlow().catch((err) => console.error("[sync] login flow failed:", err));
  }, []);

  const claim = useCallback(async (token, username, password) => {
    setError(null);
    const res = await fetch(`${apiBase}/migrate/claim`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const message = extractErrorMessage(text) || "Claim failed";
      throw new Error(message);
    }
    const data = await res.json();
    setAuthenticated(true);
    setUser({ id: data.id, username: data.username });
    // Claimed migrated account: push any local queue, then pull.
    loginFlow().catch((err) => console.error("[sync] login flow failed:", err));
  }, []);

  /**
   * Active logout (3.3):
   *   1. final push attempt of the whole queue (short timeout),
   *   2. re-check the queue,
   *   3. if entries remain → return { blocked: true, pendingCount } and
   *      let the caller show the confirmation dialog,
   *   4. on confirm (force) → server logout + wipe cache AND queue.
   */
  const logout = useCallback(async ({ force = false } = {}) => {
    // Step 1 — one last push attempt, brief timeout.
    await processQueue({
      timeoutMs: syncCfg.logoutPushTimeoutMs ?? 2500,
    }).catch(() => {});

    // Step 2 — is anything still unsynced?
    const pendingCount = await openOpCount();

    // Step 3 — real problem (not just timing): ask before discarding.
    if (pendingCount > 0 && !force) {
      return { blocked: true, pendingCount };
    }

    // Step 4 — server logout, then clear cache + queue completely.
    try {
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // session state is cleared locally regardless
    }
    await clearAll().catch(() => {});
    setAuthenticated(false);
    setUser(null);
    return { blocked: false, pendingCount: 0 };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        authenticated,
        user,
        error,
        login,
        register,
        claim,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
