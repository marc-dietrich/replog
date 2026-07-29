// src/__tests__/useSyncStatus.test.jsx
//
// Tests for useSyncStatus (src/hooks/useSyncStatus.js).
// Covers: online/offline detection via navigator.onLine,
// backend health polling, and forceSync.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSyncStatus } from "../hooks/useSyncStatus";

describe("useSyncStatus", () => {
  let originalFetch;
  let originalNavigatorOnLine;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    originalNavigatorOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(navigator, "onLine", {
      value: originalNavigatorOnLine,
      writable: true,
      configurable: true,
    });
  });

  // ── Online / offline ─────────────────────────────────────────────────

  it("isOnline reflects navigator.onLine on mount", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.isOnline).toBe(true);
  });

  it("isOnline is false when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.isOnline).toBe(false);
  });

  it("updates isOnline when browser goes offline", () => {
    const { result } = renderHook(() => useSyncStatus());

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("updates isOnline when browser comes back online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSyncStatus());

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.isOnline).toBe(true);
  });

  // ── Health polling ───────────────────────────────────────────────────

  it("calls /api/health on mount", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ db: "UP", status: "healthy" }), {
        status: 200,
      })
    );

    renderHook(() => useSyncStatus());

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("sets backendStatus to 'up' when health returns db UP", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ db: "UP" }), { status: 200 })
    );

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("up");
    });
  });

  it("sets backendStatus to 'db-down' when db is not UP", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ db: "DOWN" }), { status: 200 })
    );

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("db-down");
    });
  });

  it("sets backendStatus to 'down' on fetch failure", async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("down");
    });
  });

  it("canSync is true only when backend is up", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ db: "UP" }), { status: 200 })
    );

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("up");
    });

    expect(result.current.canSync).toBe(true);
  });

  it("canSync is false when backend is down", async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error("down"));

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("down");
    });

    expect(result.current.canSync).toBe(false);
  });

  // ── Polling interval ─────────────────────────────────────────────────

  it("polls /api/health on the configured interval", async () => {
    vi.useFakeTimers();
    globalThis.fetch.mockResolvedValue(
      new Response(JSON.stringify({ db: "UP" }), { status: 200 })
    );

    renderHook(() => useSyncStatus());

    // First call on mount — need to flush the initial promise
    await vi.runAllTicks();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Advance past pollIntervalMs (30_000)
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Another interval
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  // ── forceSync ────────────────────────────────────────────────────────

  it("forceSync calls /api/health and updates status", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ db: "DOWN" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ db: "UP" }), { status: 200 })
      );

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("db-down");
    });

    await act(async () => {
      await result.current.forceSync();
    });

    expect(result.current.backendStatus).toBe("up");
    expect(result.current.canSync).toBe(true);
    expect(result.current.lastSyncedAt).toBeGreaterThan(0);
  });

  it("forceSync handles errors gracefully", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ db: "UP" }), { status: 200 })
      )
      .mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.backendStatus).toBe("up");
    });

    await act(async () => {
      await result.current.forceSync();
    });

    expect(result.current.backendStatus).toBe("down");
  });

  // ── pendingCount ─────────────────────────────────────────────────────

  it("pendingCount is always 0 (no offline queue)", () => {
    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.pendingCount).toBe(0);
  });
});
