// src/hooks/api/client.js

import config from "virtual:app-config";
import { getToken } from "../../auth/keycloak";

const API_BASE = config.apiBase;

/**
 * Thin wrapper around fetch for the RepLog backend.
 * Attaches JSON headers, JWT auth token, and unwraps 204 No Content responses.
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const headers = { "Content-Type": "application/json", ...options.headers };

  // Attach JWT if the user is authenticated
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = { headers, ...options };

  const response = await fetch(url, config);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = body || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ── Convenience wrappers ──

export const api = {
  get: (path)              => apiFetch(path),
  post: (path, body)       => apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body)        => apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path)           => apiFetch(path, { method: "DELETE" }),
};
