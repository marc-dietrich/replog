// src/__tests__/auth.test.jsx
//
// Tests for AuthContext (src/auth/AuthContext.jsx).
// Covers: session check on mount, login, register, logout, and
// the guard that useAuth() must be inside AuthProvider.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { db } from "../db/db";

// ── Helpers ─────────────────────────────────────────────────────────────

function wrapper({ children }) {
  return React.createElement(AuthProvider, null, children);
}

function mockFetchResponse(status, body) {
  return Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
    })
  );
}

describe("AuthContext", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Mount / session check ────────────────────────────────────────────

  it("calls /api/auth/me on mount to check for existing session", async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse(401));

    renderHook(() => useAuth(), { wrapper });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("sets ready=false and authenticated=false initially", () => {
    globalThis.fetch.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.ready).toBe(false);
    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("sets authenticated=true when /me returns a user", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      mockFetchResponse(200, { id: "abc-123", username: "alice" })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.authenticated).toBe(true);
    expect(result.current.user).toEqual({ id: "abc-123", username: "alice" });
  });

  it("sets authenticated=false when /me returns 401", async () => {
    globalThis.fetch.mockResolvedValueOnce(mockFetchResponse(401));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // ── Login ────────────────────────────────────────────────────────────

  it("login calls POST /api/auth/login with credentials", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockFetchResponse(401)) // initial /me
      .mockResolvedValueOnce(
        mockFetchResponse(200, { id: "u1", username: "bob" })
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.login("bob", "secret123");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ username: "bob", password: "secret123" }),
      })
    );

    expect(result.current.authenticated).toBe(true);
    expect(result.current.user).toEqual({ id: "u1", username: "bob" });
  });

  it("login throws and sets authenticated=false on failure", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockFetchResponse(401))
      .mockResolvedValueOnce(mockFetchResponse(401, "Invalid credentials"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await expect(
        result.current.login("bob", "wrong")
      ).rejects.toThrow("Invalid credentials");
    });

    expect(result.current.authenticated).toBe(false);
  });

  // ── Register ─────────────────────────────────────────────────────────

  it("register calls POST /api/auth/register and auto-logs in", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockFetchResponse(401))
      .mockResolvedValueOnce(
        mockFetchResponse(200, { id: "new-id", username: "charlie" })
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.register("charlie", "pass123456");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "charlie", password: "pass123456" }),
      })
    );

    expect(result.current.authenticated).toBe(true);
    expect(result.current.user).toEqual({ id: "new-id", username: "charlie" });
  });

  it("register throws and stays unauthenticated on failure", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockFetchResponse(401))
      .mockResolvedValueOnce(mockFetchResponse(409, "Username already taken"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await expect(
        result.current.register("taken", "pass123456")
      ).rejects.toThrow("Username already taken");
    });

    expect(result.current.authenticated).toBe(false);
  });

  // ── Logout ───────────────────────────────────────────────────────────

  it("logout calls POST /api/auth/logout and clears state", async () => {
    // Start authenticated
    globalThis.fetch
      .mockResolvedValueOnce(
        mockFetchResponse(200, { id: "u1", username: "bob" })
      )
      .mockResolvedValueOnce(mockFetchResponse(200, { message: "Logged out" }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.authenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );

    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("logout clears state even if the server call fails", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        mockFetchResponse(200, { id: "u1", username: "bob" })
      )
      .mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(async () => {
      await result.current.logout(); // should not throw
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // ── Logout with unsynced entries (3.3 / 8b) ────────────────────────

  it("logout blocks and reports pendingCount when the final push leaves entries", async () => {
    globalThis.fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.endsWith("/auth/me")) {
        return mockFetchResponse(200, { id: "u1", username: "bob" });
      }
      if (target.endsWith("/auth/logout")) {
        return mockFetchResponse(200, { message: "Logged out" });
      }
      if (target.includes("/groups/all") || target.includes("/exercises/ungrouped")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      // all queue pushes fail — offline
      return Promise.reject(new Error("offline"));
    });

    // one pending op that will fail the final push attempt
    await db.queue.add({
      entityUuid: "e-1",
      entityType: "entry",
      op: "create",
      payload: { id: "e-1" },
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.authenticated).toBe(true);

    let outcome;
    await act(async () => {
      outcome = await result.current.logout();
    });

    expect(outcome).toEqual({ blocked: true, pendingCount: 1 });
    // blocked: no server logout, user stays logged in, queue untouched
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.anything()
    );
    expect(result.current.authenticated).toBe(true);
    expect(await db.queue.count()).toBe(1);
  });

  it("logout({ force: true }) discards unsynced entries and clears cache + queue", async () => {
    globalThis.fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.endsWith("/auth/me")) {
        return mockFetchResponse(200, { id: "u1", username: "bob" });
      }
      if (target.endsWith("/auth/logout")) {
        return mockFetchResponse(200, { message: "Logged out" });
      }
      if (target.includes("/groups/all") || target.includes("/exercises/ungrouped")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.reject(new Error("offline"));
    });

    await db.entries.add({
      id: "e-1",
      exerciseId: "ex-1",
      date: "2026-07-01",
      weight: 50,
      reps: 5,
      note: "",
      createdAt: "",
      updatedAt: "",
    });
    await db.queue.add({
      entityUuid: "e-1",
      entityType: "entry",
      op: "create",
      payload: { id: "e-1" },
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.logout({ force: true });
    });

    expect(outcome).toEqual({ blocked: false, pendingCount: 0 });
    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
    // cache AND queue are both fully cleared (3.3 step 4)
    expect(await db.entries.count()).toBe(0);
    expect(await db.queue.count()).toBe(0);
  });

  it("logout with an already-synced queue clears directly without blocking", async () => {
    globalThis.fetch.mockImplementation((url) => {
      const target = String(url);
      if (target.endsWith("/auth/me")) {
        return mockFetchResponse(200, { id: "u1", username: "bob" });
      }
      if (target.endsWith("/auth/logout")) {
        return mockFetchResponse(200, { message: "Logged out" });
      }
      if (target.includes("/groups/all") || target.includes("/exercises/ungrouped")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.logout();
    });

    expect(outcome.blocked).toBe(false);
    expect(result.current.authenticated).toBe(false);
  });

  // ── Guard ────────────────────────────────────────────────────────────

  it("useAuth throws when used outside AuthProvider", () => {
    // Suppress console.error for the expected throw
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider"
    );

    spy.mockRestore();
  });
});
