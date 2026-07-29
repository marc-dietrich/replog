// src/__tests__/api-client.test.js
//
// Tests for the thin fetch wrapper (src/hooks/api/client.js).
// Ensures every call sends credentials, sets Content-Type, and
// correctly handles success/error responses.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, apiFetch } from "../hooks/api/client";

describe("apiFetch", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Happy path ──────────────────────────────────────────────────────

  it("sends credentials: 'include' on every request", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch("/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("sets Content-Type to application/json by default", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch("/test");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("allows overriding headers via options", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch("/test", { headers: { "X-Custom": "foo" } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Custom": "foo",
        }),
      })
    );
  });

  it("returns parsed JSON for 200 responses", async () => {
    const payload = { id: 1, name: "Bench Press" };
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 })
    );

    const result = await apiFetch("/exercises/1");

    expect(result).toEqual(payload);
  });

  it("returns null for 204 No Content", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const result = await apiFetch("/exercises/1");

    expect(result).toBeNull();
  });

  // ── Error handling ──────────────────────────────────────────────────

  it("throws an error with the response body on non-ok status", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response("Username already taken", { status: 409 })
    );

    await expect(apiFetch("/auth/register")).rejects.toThrow(
      "Username already taken"
    );
  });

  it("throws a status-based error when response body is empty", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response("", { status: 500, statusText: "Internal Server Error" })
    );

    await expect(apiFetch("/test")).rejects.toThrow("500 Internal Server Error");
  });

  it("throws on network failure", async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(apiFetch("/test")).rejects.toThrow("Network error");
  });
});

// ── Convenience methods ─────────────────────────────────────────────────

describe("api convenience methods", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = vi.restoreAllMocks();
  });

  it("api.get sends a GET request", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: true }), { status: 200 })
    );

    await api.get("/groups");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/groups",
      expect.objectContaining({
        credentials: "include",
      })
    );
    // GET is the default — method should not be explicitly set
    const callArgs = globalThis.fetch.mock.calls[0][1];
    expect(callArgs.method).toBeUndefined();
  });

  it("api.post sends a POST with stringified body", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })
    );

    await api.post("/exercises", { name: "Squat", order: 0 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Squat", order: 0 }),
        credentials: "include",
      })
    );
  });

  it("api.put sends a PUT with stringified body", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await api.put("/exercises/reorder", { exerciseId: "x", newOrder: 1 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises/reorder",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ exerciseId: "x", newOrder: 1 }),
      })
    );
  });

  it("api.delete sends a DELETE request with no body", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    await api.delete("/exercises/abc-123");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises/abc-123",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      })
    );
  });
});
