// src/__tests__/useExercises.test.jsx
//
// Tests for useExercises (local-first). Covers:
//   • local cache + queue writes on every mutation (anonymous included)
//   • background sync push when authenticated (one queue op per mutation)
//   • live-reactive reads from Dexie
//   • loadMoreEntries returns { entries, totalCount }
//   • importData writes cache first, then enqueues create ops (Q10)
//   • cache cap eviction: only synced entries are removed (section 6)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useExercises } from "../hooks/useExercises";
import { db } from "../db/db";

// ── Mock useAuth ───────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function mockAuth(overrides = {}) {
  mockUseAuth.mockReturnValue({
    authenticated: true,
    user: { id: "user-1", username: "tester" },
    ready: true,
    ...overrides,
  });
}

function jsonResponse(body, status = 200) {
  if (status === 204) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const okJson = () => jsonResponse({ ok: true });

// ── Seed helpers ───────────────────────────────────────────────────────

async function seedExercise(overrides = {}) {
  const id = overrides.id ?? "ex-1";
  await db.exercises.add({
    id,
    name: "Bench Press",
    order: 0,
    groupId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
  return id;
}

async function seedEntry(exerciseId, entryId, date) {
  await db.entries.add({
    id: entryId,
    exerciseId,
    date,
    weight: 100,
    reps: 5,
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("useExercises (local-first)", () => {
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
  // Reactive local reads
  // ══════════════════════════════════════════════════════════════════════

  it("reads exercises and their entries reactively from the cache", async () => {
    mockAuth({ authenticated: false });

    await seedExercise({ id: "ex-1" });
    await seedEntry("ex-1", "e1", "2026-01-02");
    await seedEntry("ex-1", "e2", "2026-01-01");

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(1);
    });

    expect(result.current.exercises[0].id).toBe("ex-1");
    // entries sorted ascending by date
    expect(result.current.exercises[0].entries.map((e) => e.id)).toEqual(["e2", "e1"]);
  });

  it("maps group data to { id, name, order }", async () => {
    mockAuth({ authenticated: false });
    await db.groups.add({
      id: "g1",
      name: "Push",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useExercises());

    await waitFor(() => {
      expect(result.current.groups).toHaveLength(1);
    });
    expect(result.current.groups[0]).toEqual({ id: "g1", name: "Push", order: 0 });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Anonymous usage (section 3.1): cache + queue, no sync attempt
  // ══════════════════════════════════════════════════════════════════════

  it("anonymous addExercise writes cache + queue but never syncs", async () => {
    mockAuth({ authenticated: false });
    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.addExercise("Squat");
    });

    const stored = await db.exercises.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Squat");
    expect(stored[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored[0].createdAt).toBeDefined();
    expect(stored[0].updatedAt).toBeDefined();

    const queue = await db.queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0].entityType).toBe("exercise");
    expect(queue[0].op).toBe("create");
    expect(queue[0].status).toBe("pending");

    // No session → no sync attempt at all
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Authenticated mutations: cache + queue + background push
  // ══════════════════════════════════════════════════════════════════════

  it("authenticated addExercise pushes the create op to the backend", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(okJson());

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.addExercise("Deadlift");
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/exercises",
        expect.objectContaining({ method: "POST" })
      );
    });

    const queue = await db.queue.toArray();
    expect(queue[0].status).toBe("synced"); // ack-based
    expect(queue[0].payload.name).toBe("Deadlift");
    expect(queue[0].payload.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("addEntry writes locally and pushes a create op with client uuid + timestamps", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(okJson());
    await seedExercise({ id: "ex-1" });

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.addEntry("ex-1", "2026-07-29", 85.5, 10, "felt good");
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/entries",
        expect.objectContaining({ method: "POST" })
      );
    });

    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].exerciseId).toBe("ex-1");
    expect(entries[0].weight).toBe(85.5);

    const queue = await db.queue.toArray();
    const payload = queue[0].payload;
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.createdAt).toBeDefined();
    expect(payload.updatedAt).toBeDefined();
    expect(payload.exerciseId).toBe("ex-1");
  });

  it("addEntry does nothing when date is missing", async () => {
    mockAuth({ authenticated: true });
    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.addEntry("ex-1", null, 100, 5);
    });

    expect(await db.entries.count()).toBe(0);
    expect(await db.queue.count()).toBe(0);
  });

  it("deleteEntry removes locally and enqueues a delete op", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(jsonResponse(null, 204));
    await seedExercise({ id: "ex-1" });
    await seedEntry("ex-1", "e1", "2026-01-02");

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.deleteEntry("ex-1", { id: "e1" });
    });

    expect(await db.entries.count()).toBe(0);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/entries/e1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    const queue = await db.queue.toArray();
    expect(queue[0]).toMatchObject({ entityUuid: "e1", op: "delete" });
  });

  it("deleteExercise removes exercise + entries locally and enqueues one delete op", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(jsonResponse(null, 204));
    await seedExercise({ id: "ex-1" });
    await seedEntry("ex-1", "e1", "2026-01-02");

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.deleteExercise("ex-1");
    });

    expect(await db.exercises.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);

    // Q5: ONE delete op for the exercise — no per-entry ops
    const queue = await db.queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ entityUuid: "ex-1", op: "delete", entityType: "exercise" });
  });

  it("deleteGroup ungroups its exercises locally and enqueues a delete op", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(jsonResponse(null, 204));
    await db.groups.add({
      id: "g1",
      name: "Push",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await seedExercise({ id: "ex-1", groupId: "g1" });

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.deleteGroup("g1");
    });

    const exercises = await db.exercises.toArray();
    expect(exercises[0].groupId).toBeNull();

    const queue = await db.queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ entityUuid: "g1", op: "delete", entityType: "group" });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Reorder → update ops with full new state (Q4)
  // ══════════════════════════════════════════════════════════════════════

  it("reorderGroups enqueues update ops for groups whose order changed", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(okJson());
    await db.groups.bulkAdd([
      { id: "g1", name: "Push", order: 0, createdAt: "", updatedAt: "" },
      { id: "g2", name: "Pull", order: 1, createdAt: "", updatedAt: "" },
    ]);

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.reorderGroups(["g2", "g1"]);
    });

    const groups = await db.groups.toArray();
    const g1 = groups.find((g) => g.id === "g1");
    const g2 = groups.find((g) => g.id === "g2");
    expect(g1.order).toBe(1);
    expect(g2.order).toBe(0);

    const ops = await db.queue.toArray();
    expect(ops.map((o) => o.op)).toEqual(["update", "update"]);
    expect(ops.every((o) => o.entityType === "group")).toBe(true);
    expect(ops[0].payload).toMatchObject({ id: "g2", order: 0 });
  });

  it("moveExercise updates orders locally and enqueues update ops", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(okJson());
    await seedExercise({ id: "ex-1", order: 0 });
    await seedExercise({ id: "ex-2", order: 1 });
    await seedExercise({ id: "ex-3", order: 2 });

    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.moveExercise("ex-3", null, 0);
    });

    const exercises = await db.exercises.toArray();
    const byId = Object.fromEntries(exercises.map((e) => [e.id, e.order]));
    expect(byId).toEqual({ "ex-1": 1, "ex-2": 2, "ex-3": 0 });

    const ops = await db.queue.toArray();
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((o) => o.op === "update" && o.entityType === "exercise")).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════
  // loadMoreEntries (R3): transient server data, not written to cache
  // ══════════════════════════════════════════════════════════════════════

  it("loadMoreEntries returns { entries, totalCount } without touching the cache", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(
      jsonResponse({
        entries: [{ id: "e-old", date: "2025-01-01", weight: 50, reps: 5, note: "" }],
        totalCount: 42,
        offset: 0,
        limit: 200,
      })
    );

    const { result } = renderHook(() => useExercises());

    let page;
    await act(async () => {
      page = await result.current.loadMoreEntries("ex-1");
    });

    expect(page.totalCount).toBe(42);
    expect(page.entries).toHaveLength(1);

    // R3: must NOT be persisted into the capped cache
    expect(await db.entries.count()).toBe(0);
  });

  // ══════════════════════════════════════════════════════════════════════
  // importData (Q10): cache first, then one create op per entity
  // ══════════════════════════════════════════════════════════════════════

  it("importData writes cache first, then enqueues one create op per entity", async () => {
    mockAuth({ authenticated: true });
    globalThis.fetch.mockResolvedValue(okJson());

    const { result } = renderHook(() => useExercises());

    const importPayload = {
      groups: [{ id: "old-g1", name: "Imported Group", order: 0 }],
      exercises: [
        {
          id: "old-ex1",
          name: "Imported Exercise",
          order: 0,
          groupId: "old-g1",
          entries: [{ date: "2026-07-01", weight: 60, reps: 12, note: "import" }],
        },
      ],
    };

    await act(async () => {
      await result.current.importData(importPayload);
    });

    expect(await db.groups.count()).toBe(1);
    expect(await db.exercises.count()).toBe(1);
    expect(await db.entries.count()).toBe(1);

    const storedExercise = (await db.exercises.toArray())[0];
    const storedGroup = (await db.groups.toArray())[0];
    expect(storedExercise.groupId).toBe(storedGroup.id);

    const ops = await db.queue.toArray();
    expect(ops).toHaveLength(3);
    expect(ops.filter((o) => o.op === "create" && o.entityType === "group")).toHaveLength(1);
    expect(ops.filter((o) => o.op === "create" && o.entityType === "exercise")).toHaveLength(1);
    expect(ops.filter((o) => o.op === "create" && o.entityType === "entry")).toHaveLength(1);
  });

  it("importData throws for invalid payload format", async () => {
    mockAuth({ authenticated: true });
    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await expect(result.current.importData({})).rejects.toThrow("Invalid import format");
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Cache cap eviction (section 6)
  // ══════════════════════════════════════════════════════════════════════

  it("evicts oldest synced entries when an exercise exceeds the cap", async () => {
    mockAuth({ authenticated: false });
    await seedExercise({ id: "ex-1" });
    for (let i = 0; i < 12; i++) {
      await seedEntry("ex-1", `e-${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`);
    }

    renderHook(() => useExercises());

    // cap = 10: the two oldest (e-0, e-1) must be evicted
    await waitFor(async () => {
      expect(await db.entries.count()).toBe(10);
    });

    const remaining = await db.entries.toArray();
    expect(remaining.some((e) => e.id === "e-0")).toBe(false);
    expect(remaining.some((e) => e.id === "e-1")).toBe(false);
    expect(remaining.some((e) => e.id === "e-11")).toBe(true);
  });

  it("never evicts entries with open queue ops, regardless of age", async () => {
    mockAuth({ authenticated: false });
    await seedExercise({ id: "ex-1" });
    for (let i = 0; i < 12; i++) {
      await seedEntry("ex-1", `e-${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`);
    }
    // e-0 is the oldest and has a pending op → untouchable
    await db.queue.add({
      entityUuid: "e-0",
      entityType: "entry",
      op: "create",
      payload: {},
      status: "pending",
      retryCount: 0,
      createdAt: Date.now(),
    });

    renderHook(() => useExercises());

    await waitFor(async () => {
      expect(await db.entries.count()).toBe(10); // e-1 and e-2 evicted, e-0 protected
    });

    const remaining = await db.entries.toArray();
    expect(remaining.some((e) => e.id === "e-0")).toBe(true);
    expect(remaining.some((e) => e.id === "e-1")).toBe(false);
    expect(remaining.some((e) => e.id === "e-2")).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════
  // refresh(): local re-read only, no server call (G3)
  // ══════════════════════════════════════════════════════════════════════

  it("refresh never calls the server", async () => {
    mockAuth({ authenticated: true });
    const { result } = renderHook(() => useExercises());

    await act(async () => {
      await result.current.refresh();
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
