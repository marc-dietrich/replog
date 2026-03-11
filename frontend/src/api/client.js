// src/api/client.js
// Centralized API client for the RepLog backend.

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include", // always send cookies (session / guest_id)
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || res.statusText), {
      status: res.status,
    });
  }
  return res.json();
}

// ---------- Auth ----------

export const authApi = {
  /** Get current user + state (works for guests too) */
  me: () => request("/auth/me"),

  /** Exchange a Google ID-token for a session; optionally claim guest data */
  google: (idToken, claimGuestData = false) =>
    request("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, claimGuestData }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),
};

// ---------- Data ----------

export const dataApi = {
  /** Fetch user state */
  get: () => request("/data"),

  /** Full state replacement (PUT) */
  put: (state) =>
    request("/data", {
      method: "PUT",
      body: JSON.stringify(state),
    }),
};
