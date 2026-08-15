// src/__tests__/sync.test.js
//
// Tests for the sync engine (src/db/sync.js) — core spec scenarios:
//   1.  anonymous ops stay pending, no hard failure
//   3.  create → update → delete of one UUID processed serially, in order
//   4/6. network errors leave entries pending and never abort the queue
//   5.  server errors (4xx) → failed after max retries, no further attempt
//   R1. pull skips entities with open queue ops (no resurrection)
//   S2. clearAll wipes cache AND queue (logout)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db, QUEUE_STATUS } from "../db/db";
import {
  applyCapEviction,
  clearAll,
  enqueueOp,
  hasOpenOp,
  loginFlow,
  openOpCount,
  processQueue,
  pull,
} from "../db/sync";

const jsonOk = () =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
const json204 = () => Promise.resolve(new Response(null, { status: 204 }));
const httpError = (status, body = "") =>
  Promise.resolve(new Response(body, { status }));

describe("sync engine", () => {
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
  // 1. Queue basics
  // ══════════════════════════════════════════════════════════════════════

  it("enqueueOp creates a pending entry with op metadata", async () => {
    await enqueueOp("exercise", "ex-1", "create", { name: "Squat" });

    const queue = await db.queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      entityUuid: "ex-1",
      entityType: "exercise",
      op: "create",
      status: QUEUE_STATUS.PENDING,
      retryCount: 0,
    });
    expect(queue[0].payload).toEqual({ name: "Squat" });
  });

  it("openOpCount counts pending/syncing/failed, hasOpenOp checks by uuid", async () => {
    await enqueueOp("entry", "e1", "create", {});
    await enqueueOp("entry", "e2", "create", {});
    await db.queue.add({
      entityUuid: "e3",
      entityType: "entry",
      op: "delete",
      payload: null,
      status: QUEUE_STATUS.SYNCED,
      retryCount: 0,
      createdAt: 0,
    });

    expect(await openOpCount()).toBe(2);
    expect(await hasOpenOp("e1")).toBe(true);
    expect(await hasOpenOp("e3")).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. Serial processing in queue order (create → update → delete)
  // ══════════════════════════════════════════════════════════════════════

  it("processes create → update → delete of one uuid serially, in order", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonOk()) // create
      .mockResolvedValueOnce(jsonOk()) // update
      .mockResolvedValueOnce(json204()); // delete

    await enqueueOp("exercise", "ex-1", "create", { id: "ex-1", name: "Squat" });
    await enqueueOp("exercise", "ex-1", "update", { id: "ex-1", name: "Squat v2" });
    await enqueueOp("exercise", "ex-1", "delete", null);

    await processQueue();

    const calls = globalThis.fetch.mock.calls.map((c) => c[1].method);
    expect(calls).toEqual(["POST", "PUT", "DELETE"]);

    const queue = await db.queue.toArray();
    expect(queue.every((q) => q.status === QUEUE_STATUS.SYNCED)).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4 + 6. Network errors: stays pending, retries, never aborts the queue
  // ══════════════════════════════════════════════════════════════════════

  it("network error leaves the entry pending and the queue continues", async () => {
    globalThis.fetch
      .mockRejectedValueOnce(new Error("Network down")) // op 1 fails
      .mockResolvedValueOnce(jsonOk()); // op 2 succeeds

    await enqueueOp("exercise", "ex-1", "create", { id: "ex-1" });
    await enqueueOp("exercise", "ex-2", "create", { id: "ex-2" });

    await processQueue();

    const queue = await db.queue.toArray();
    const op1 = queue.find((q) => q.entityUuid === "ex-1");
    const op2 = queue.find((q) => q.entityUuid === "ex-2");

    expect(op1.status).toBe(QUEUE_STATUS.PENDING);
    expect(op1.retryCount).toBe(1);
    expect(op2.status).toBe(QUEUE_STATUS.SYNCED);

    // next trigger retries op1 and succeeds
    globalThis.fetch.mockResolvedValueOnce(jsonOk());
    await processQueue();
    const retried = (await db.queue.toArray()).find((q) => q.entityUuid === "ex-1");
    expect(retried.status).toBe(QUEUE_STATUS.SYNCED);
  });

  it("4xx failure retries like a network error and blocks nothing", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(httpError(400, "bad request")) // op 1 → 4xx
      .mockResolvedValueOnce(jsonOk()); // op 2 succeeds

    await enqueueOp("group", "g-1", "create", { id: "g-1" });
    await enqueueOp("group", "g-2", "create", { id: "g-2" });

    await processQueue();

    const queue = await db.queue.toArray();
    expect(queue.find((q) => q.entityUuid === "g-1")).toMatchObject({
      status: QUEUE_STATUS.PENDING,
      retryCount: 1,
    });
    expect(queue.find((q) => q.entityUuid === "g-2").status).toBe(QUEUE_STATUS.SYNCED);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. Max retries → failed, no further automatic attempts
  // ══════════════════════════════════════════════════════════════════════

  it("marks an entry failed after max retries and does not retry it again", async () => {
    globalThis.fetch.mockResolvedValue(httpError(500, "boom"));

    await enqueueOp("entry", "e-1", "create", { id: "e-1" });

    await processQueue({ maxRetries: 3 });
    await processQueue({ maxRetries: 3 });
    await processQueue({ maxRetries: 3 });

    const queue = await db.queue.toArray();
    expect(queue[0]).toMatchObject({ status: QUEUE_STATUS.FAILED, retryCount: 3 });

    // failed entries are no longer attempted
    const callsAfter = globalThis.fetch.mock.calls.length;
    await processQueue({ maxRetries: 3 });
    expect(globalThis.fetch.mock.calls.length).toBe(callsAfter);
  });

  // ══════════════════════════════════════════════════════════════════════
  // R1. Pull skips entities with open ops (no resurrection)
  // ══════════════════════════════════════════════════════════════════════

  it("pull upserts server data but skips uuid with a pending delete", async () => {
    // Server still returns ex-1 (the delete hasn't reached it yet)
    globalThis.fetch.mockImplementation((url) => {
      if (String(url).includes("/groups/all")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { id: "ex-1", name: "Squat", order: 0, entries: [] },
            { id: "ex-2", name: "Bench", order: 1, entries: [] },
          ]),
          { status: 200 }
        )
      );
    });

    await db.exercises.add({ id: "ex-1", name: "Squat", order: 0, groupId: null });
    // local mutation: entity removed from cache + delete op enqueued
    await db.exercises.delete("ex-1");
    await enqueueOp("exercise", "ex-1", "delete", null);

    await pull();

    const exercises = await db.exercises.toArray();
    // ex-1 must NOT have been re-written into the cache (tombstone),
    // ex-2 is a normal upsert
    expect(exercises.some((e) => e.id === "ex-1")).toBe(false);
    expect(exercises.some((e) => e.id === "ex-2")).toBe(true);
  });

  it("loginFlow pushes before pulling", async () => {
    const order = [];
    globalThis.fetch.mockImplementation((url, init = {}) => {
      order.push(init.method ?? "GET");
      if (String(url).includes("/groups/all") || String(url).includes("/exercises/ungrouped")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    await enqueueOp("group", "g-1", "create", { id: "g-1" });
    await loginFlow();

    // Strict order: POST (push) before the GET pulls
    expect(order.indexOf("POST")).toBeLessThan(order.indexOf("GET"));
  });

  it("pull overwrites entities whose only open op is failed (server wins — R1)", async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (String(url).includes("/groups/all")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { id: "ex-1", name: "Squat (server)", order: 0, entries: [] },
          ]),
          { status: 200 }
        )
      );
    });

    await db.exercises.add({ id: "ex-1", name: "Squat (local)", order: 0, groupId: null });
    await db.queue.add({
      entityUuid: "ex-1",
      entityType: "exercise",
      op: "create",
      payload: {},
      status: QUEUE_STATUS.FAILED,
      retryCount: 100,
      createdAt: 0,
    });

    await pull();

    const exercise = await db.exercises.get("ex-1");
    expect(exercise.name).toBe("Squat (server)");
  });

  // ══════════════════════════════════════════════════════════════════════
  // S2. clearAll wipes cache AND queue (logout step 4)
  // ══════════════════════════════════════════════════════════════════════

  it("clearAll removes entities and queue entries alike", async () => {
    await db.groups.add({ id: "g1", name: "Push", order: 0, createdAt: "", updatedAt: "" });
    await db.exercises.add({ id: "ex1", name: "Squat", order: 0, groupId: null });
    await enqueueOp("entry", "e1", "create", {});

    await clearAll();

    expect(await db.groups.count()).toBe(0);
    expect(await db.exercises.count()).toBe(0);
    expect(await db.queue.count()).toBe(0);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Cap eviction: only entries without open ops are evictable (F4)
  // ══════════════════════════════════════════════════════════════════════

  it("applyCapEviction removes oldest by date but never entries with open ops", async () => {
    await db.exercises.add({ id: "ex1", name: "Squat", order: 0, groupId: null });
    for (let i = 0; i < 12; i++) {
      await db.entries.add({
        id: `e-${i}`,
        exerciseId: "ex1",
        date: `2026-01-${String(i + 1).padStart(2, "0")}`,
        weight: 100,
        reps: 5,
      });
    }
    // e-0 + e-1 are protected by open ops
    await enqueueOp("entry", "e-0", "create", {});
    await enqueueOp("entry", "e-1", "update", {});

    await applyCapEviction(10);

    const remaining = (await db.entries.toArray()).map((e) => e.id);
    expect(remaining).toHaveLength(10);
    expect(remaining).toContain("e-0");
    expect(remaining).toContain("e-1");
    // oldest unprotected entries (e-2, e-3) evicted
    expect(remaining).not.toContain("e-2");
    expect(remaining).not.toContain("e-3");
    expect(remaining).toContain("e-11");
  });
});
