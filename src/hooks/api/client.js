// src/hooks/api/client.js
//
// Thin fetch wrapper for the RepLog backend.
// Uses session cookies (credentials: "include") — no JWT management needed.

import config from "virtual:app-config";

const API_BASE = config.apiBase;

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = body || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: "DELETE" }),
};
