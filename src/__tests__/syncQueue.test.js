// src/__tests__/syncQueue.test.js
//
// Tests for the sync queue (src/sync/queue.js).
// These test queue operations without actually hitting the network.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import db from "../db/dexie";
import {
  addToQueue,
  getPendingCount,
  checkHealth,
  getLastHealthStatus,
  resetHealthCache,
  canSync,
} from "../sync/queue";

// Helper: force navigator.onLine for health check tests
function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(async () => {
  await db.syncQueue.clear();
  vi.restoreAllMocks();
  setOnline(true);
  resetHealthCache();
});

// ── Queue operations ───────────────────────────────────────────────────────

describe("addToQueue", () => {
  it("adds a create operation to the queue", async () => {
    await addToQueue("entry", "temp_123", "create", {
      date: "2026-07-26",
      weight: 100,
      reps: 5,
      exerciseId: "ex-1",
    });

    const pending = await getPendingCount();
    expect(pending).toBe(1);

    const items = await db.syncQueue.toArray();
    expect(items[0].entityType).toBe("entry");
    expect(items[0].entityId).toBe("temp_123");
    expect(items[0].operation).toBe("create");
    expect(items[0].payload.weight).toBe(100);
    expect(items[0].retries).toBe(0);
  });

  it("adds a delete operation to the queue", async () => {
    await addToQueue("exercise", "ex-1", "delete", null);

    const pending = await getPendingCount();
    expect(pending).toBe(1);

    const items = await db.syncQueue.toArray();
    expect(items[0].operation).toBe("delete");
    expect(items[0].payload).toBeNull();
  });

  it("queues multiple operations and preserves order by timestamp", async () => {
    await addToQueue("group", "g1", "create", { name: "First", order: 0 });
    await new Promise((r) => setTimeout(r, 10)); // ensure different timestamps
    await addToQueue("group", "g2", "create", { name: "Second", order: 1 });

    const items = await db.syncQueue.orderBy("timestamp").toArray();
    expect(items).toHaveLength(2);
    expect(items[0].payload.name).toBe("First");
    expect(items[1].payload.name).toBe("Second");
  });
});

describe("getPendingCount", () => {
  it("returns 0 when queue is empty", async () => {
    const count = await getPendingCount();
    expect(count).toBe(0);
  });

  it("returns correct count after adding items", async () => {
    await addToQueue("entry", "e1", "create", {});
    await addToQueue("entry", "e2", "create", {});
    await addToQueue("entry", "e3", "delete", null);

    const count = await getPendingCount();
    expect(count).toBe(3);
  });
});

// ── Health check ───────────────────────────────────────────────────────────

describe("checkHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  it("returns 'offline' when navigator.onLine is false", async () => {
    setOnline(false);

    const status = await checkHealth();
    expect(status).toBe("offline");
  });

  it("returns 'down' when fetch throws", async () => {
    setOnline(true);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const status = await checkHealth();
    expect(status).toBe("down");
  });

  it("returns 'db-down' when db status is DOWN", async () => {
    setOnline(true);
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: "DOWN", db: "DOWN", timestamp: "2026-01-01T00:00:00Z" }),
    });

    const status = await checkHealth();
    expect(status).toBe("db-down");
  });

  it("returns 'up' when everything is healthy", async () => {
    setOnline(true);
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: "UP", db: "UP", timestamp: "2026-01-01T00:00:00Z" }),
    });

    const status = await checkHealth();
    expect(status).toBe("up");
  });
});

describe("canSync", () => {
  it("returns true when health status is 'up'", async () => {
    setOnline(true);
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: "UP", db: "UP", timestamp: "2026-01-01T00:00:00Z" }),
    });

    await checkHealth();
    expect(canSync()).toBe(true);
  });

  it("returns false when health status is 'down'", async () => {
    setOnline(true);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

    await checkHealth();
    expect(canSync()).toBe(false);
  });
});
