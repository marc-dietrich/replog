// src/auth/AuthContext.jsx
//
// Simple username+password authentication with session cookies.
// No Keycloak, no JWT management — the browser handles the session cookie.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import config from "virtual:app-config";

const { apiBase } = config;

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

  // Check if we already have a session on mount
  useEffect(() => {
    fetch(`${apiBase}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        setAuthenticated(true);
        setUser({ id: data.id, username: data.username });
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
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setAuthenticated(false);
    setUser(null);
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
