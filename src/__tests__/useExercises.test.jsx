// src/__tests__/useExercises.test.jsx
//
// Tests for useExercises (src/hooks/useExercises.js).
// Covers: auth-gated data loading, all CRUD mutations, import, and
// the guarantee that unauthenticated users see empty data.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useExercises } from "../hooks/useExercises";

// ── Mock useAuth ───────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Helpers ────────────────────────────────────────────────────────────

function mockAuth(overrides = {}) {
  mockUseAuth.mockReturnValue({
    authenticated: true,
    user: { id: "user-1", username: "tester" },
    ready: true,
    ...overrides,
  });
}

function jsonResponse(body, status = 200) {
  // 204 No Content must not have a body
  if (status === 204) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return Promise.resolve(
    new Response(JSON.stringify(body), { status })
  );
}

// ── Sample server data ─────────────────────────────────────────────────

const sampleGroups = [
  {
    id: "g1",
    name: "Push",
    order: 0,
    exercises: [
      {
        id: "ex1",
        name: "Bench Press",
        order: 0,
        entries: [
          { id: "e1", date: "2026-01-01", weight: 100, reps: 5, note: "" },
        ],
      },
    ],
  },
];

const sampleUngrouped = [
  {
    id: "ex2",
    name: "Squat",
    order: 0,
    entries: [
      { id: "e2", date: "2026-01-02", weight: 120, reps: 8, note: "deep" },
    ],
  },
];

describe("useExercises", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Auth gate
  // ══════════════════════════════════════════════════════════════════════

  it("does NOT fetch when user is not authenticated", async () => {
    mockAuth({ authenticated: false });

    renderHook(() => useExercises());

    // Let any effects settle
    await vi.waitFor(() => {}, { timeout: 100 });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns empty arrays when not authenticated", () => {
    mockAuth({ authenticated: false });

    const { result } = renderHook(() => useExercises());

    expect(result.current.exercises).toEqual([]);
    expect(result.current.groups).toEqual([]);
  });

  it("fetches data on mount when authenticated", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse(sampleUngrouped));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBeGreaterThan(0);
    });

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe("Push");
    expect(result.current.exercises).toHaveLength(2);
  });

  it("clears data when user logs out", async () => {
    // Start authenticated
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse(sampleUngrouped));

    const { result, rerender } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(2);
    });

    // Simulate logout
    mockAuth({ authenticated: false });
    rerender();

    await waitFor(() => {
      expect(result.current.exercises).toEqual([]);
    });
    expect(result.current.groups).toEqual([]);
  });

  it("fetches data when auth state changes from false to true", async () => {
    mockAuth({ authenticated: false });
    const { result, rerender } = renderHook(() => useExercises());

    expect(result.current.exercises).toEqual([]);

    // Simulate login
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse(sampleUngrouped));
    rerender();

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Data flattening
  // ══════════════════════════════════════════════════════════════════════

  it("flattens grouped exercises with correct groupId", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });

    expect(result.current.exercises[0].groupId).toBe("g1");
    expect(result.current.exercises[0].name).toBe("Bench Press");
  });

  it("sets groupId to null for ungrouped exercises", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(sampleUngrouped));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });

    expect(result.current.exercises[0].groupId).toBeNull();
  });

  it("normalises entries: converts weight to Number and defaults note", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });

    const entry = result.current.exercises[0].entries[0];
    expect(typeof entry.weight).toBe("number");
    expect(entry.weight).toBe(100);
    expect(entry.note).toBe("");
  });

  // ══════════════════════════════════════════════════════════════════════
  // addExercise
  // ══════════════════════════════════════════════════════════════════════

  it("addExercise posts and refreshes", async () => {
    mockAuth({ authenticated: true });
    // Initial load
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      // POST exercise
      .mockResolvedValueOnce(jsonResponse({ id: "new-ex" }))
      // After refresh
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          { id: "new-ex", name: "Deadlift", order: 0, entries: [] },
        ])
      );

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(0); // initial empty
    });

    await act(async () => {
      await result.current.addExercise("Deadlift");
    });

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });
    expect(result.current.exercises[0].name).toBe("Deadlift");
  });

  it("addExercise does nothing for empty name", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    const callCount = globalThis.fetch.mock.calls.length;
    await act(async () => {
      await result.current.addExercise("   ");
    });

    // No additional fetch calls
    expect(globalThis.fetch.mock.calls.length).toBe(callCount);
  });

  // ══════════════════════════════════════════════════════════════════════
  // addGroup
  // ══════════════════════════════════════════════════════════════════════

  it("addGroup posts and refreshes", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: "g-new" }))
      .mockResolvedValueOnce(
        jsonResponse([{ id: "g-new", name: "Legs", order: 0, exercises: [] }])
      )
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.groups).toBeDefined();
    });

    await act(async () => {
      await result.current.addGroup("Legs");
    });

    await waitFor(() => {
      expect(result.current.groups.length).toBe(1);
    });
  });

  it("addGroup does nothing for empty name", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.groups).toBeDefined();
    });

    const callCount = globalThis.fetch.mock.calls.length;
    await act(async () => {
      await result.current.addGroup("  ");
    });

    expect(globalThis.fetch.mock.calls.length).toBe(callCount);
  });

  // ══════════════════════════════════════════════════════════════════════
  // addEntry
  // ══════════════════════════════════════════════════════════════════════

  it("addEntry posts correct payload and refreshes", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: "entry-new" }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    await act(async () => {
      await result.current.addEntry("ex1", "2026-07-29", 85.5, 10, "felt good");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/entries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          date: "2026-07-29",
          weight: 85.5,
          reps: 10,
          note: "felt good",
          exerciseId: "ex1",
        }),
      })
    );
  });

  it("addEntry does nothing when date is missing", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    const callCount = globalThis.fetch.mock.calls.length;
    await act(async () => {
      await result.current.addEntry("ex1", null, 100, 5);
    });

    expect(globalThis.fetch.mock.calls.length).toBe(callCount);
  });

  // ══════════════════════════════════════════════════════════════════════
  // deleteExercise
  // ══════════════════════════════════════════════════════════════════════

  it("deleteExercise sends DELETE and refreshes", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(null, 204))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });

    await act(async () => {
      await result.current.deleteExercise("ex1");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises/ex1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  // ══════════════════════════════════════════════════════════════════════
  // deleteEntry
  // ══════════════════════════════════════════════════════════════════════

  it("deleteEntry sends DELETE for the entry", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(null, 204))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises.length).toBe(1);
    });

    await act(async () => {
      await result.current.deleteEntry("ex1", { id: "e1" });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/entries/e1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("deleteEntry does nothing when entry has no id", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    const callCount = globalThis.fetch.mock.calls.length;
    await act(async () => {
      await result.current.deleteEntry("ex1", null);
    });

    expect(globalThis.fetch.mock.calls.length).toBe(callCount);
  });

  // ══════════════════════════════════════════════════════════════════════
  // deleteGroup
  // ══════════════════════════════════════════════════════════════════════

  it("deleteGroup sends DELETE and refreshes", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(sampleGroups))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(null, 204))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.groups.length).toBe(1);
    });

    await act(async () => {
      await result.current.deleteGroup("g1");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/groups/g1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  // ══════════════════════════════════════════════════════════════════════
  // moveExercise
  // ══════════════════════════════════════════════════════════════════════

  it("moveExercise sends PUT to reorder endpoint", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(sampleUngrouped))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    await act(async () => {
      await result.current.moveExercise("ex2", "g1", 0);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises/reorder",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          exerciseId: "ex2",
          targetGroupId: "g1",
          newOrder: 0,
        }),
      })
    );
  });

  // ══════════════════════════════════════════════════════════════════════
  // reorderGroups
  // ══════════════════════════════════════════════════════════════════════

  it("reorderGroups sends PUT for each group whose order changed", async () => {
    mockAuth({ authenticated: true });
    const twoGroups = [
      { id: "g1", name: "Push", order: 0, exercises: [] },
      { id: "g2", name: "Pull", order: 1, exercises: [] },
    ];
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(twoGroups))
      .mockResolvedValueOnce(jsonResponse([]))
      // Two reorder PUTs
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      // Refresh
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.groups.length).toBe(2);
    });

    // Swap: g2 first, g1 second
    await act(async () => {
      await result.current.reorderGroups(["g2", "g1"]);
    });

    // g2 moved from index 1 to index 0
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/groups/reorder",
      expect.objectContaining({
        body: JSON.stringify({ groupId: "g2", newOrder: 0 }),
      })
    );
    // g1 moved from index 0 to index 1
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/groups/reorder",
      expect.objectContaining({
        body: JSON.stringify({ groupId: "g1", newOrder: 1 }),
      })
    );
  });

  // ══════════════════════════════════════════════════════════════════════
  // importData
  // ══════════════════════════════════════════════════════════════════════

  it("importData creates groups and exercises with entries", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      // Create group
      .mockResolvedValueOnce(jsonResponse({ id: "g-imported" }))
      // Create exercise
      .mockResolvedValueOnce(jsonResponse({ id: "ex-imported" }))
      // Create entry
      .mockResolvedValueOnce(jsonResponse({ id: "entry-imported" }))
      // Refresh
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    const importPayload = {
      groups: [{ id: "old-g1", name: "Imported Group", order: 0 }],
      exercises: [
        {
          id: "old-ex1",
          name: "Imported Exercise",
          order: 0,
          groupId: "old-g1",
          entries: [
            { date: "2026-07-01", weight: 60, reps: 12, note: "import" },
          ],
        },
      ],
    };

    await act(async () => {
      await result.current.importData(importPayload);
    });

    // Verify group creation
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/groups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Imported Group", order: 0 }),
      })
    );

    // Verify exercise creation with remapped groupId
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/exercises",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Imported Exercise",
          order: 0,
          groupId: "g-imported",
        }),
      })
    );

    // Verify entry creation
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/entries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          date: "2026-07-01",
          weight: 60,
          reps: 12,
          note: "import",
          exerciseId: "ex-imported",
        }),
      })
    );
  });

  it("importData throws for invalid payload format", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    await act(async () => {
      await expect(result.current.importData({})).rejects.toThrow(
        "Invalid import format"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // loadMoreEntries
  // ══════════════════════════════════════════════════════════════════════

  it("loadMoreEntries returns totalCount", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [],
          totalCount: 42,
          offset: 0,
          limit: 200,
        })
      );

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toBeDefined();
    });

    let totalCount;
    await act(async () => {
      totalCount = await result.current.loadMoreEntries("ex1");
    });

    expect(totalCount).toBe(42);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Error handling
  // ══════════════════════════════════════════════════════════════════════

  it("sets error state when initial fetch fails", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockRejectedValueOnce(new Error("Network down"));

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.error).toBe("Network down");
    });
  });

  it("sets loading=true during fetch", async () => {
    mockAuth({ authenticated: true });
    // Delay the response
    globalThis.fetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(new Response(JSON.stringify([]), { status: 200 })),
            100
          )
        )
    );

    const { result } = renderHook(() => useExercises());

    // loading should be true while fetch is pending
    await waitFor(() => {
      expect(result.current.syncing).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.syncing).toBe(false);
    });
  });
});
