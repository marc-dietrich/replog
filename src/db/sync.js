// src/db/sync.js
//
// Sync engine — pushes the op queue to the backend (serially, ack-based)
// and pulls the latest server state into the cache (paginated/capped).
//
// Explicit triggers only (per spec):
//   • new entity → processQueue()
//   • login / session restore / register / claim → loginFlow() (push, then pull)
//   • active logout → final push attempt, then clear cache + queue
//
// No polling, no navigator.onLine pre-checks, no queue compaction.

import { db, ENTITY_PATHS, QUEUE_STATUS } from "./db";
import config from "virtual:app-config";

const { sync: syncCfg, entries: entriesCfg } = config;

const MAX_RETRIES = syncCfg.maxRetries ?? 100;
const PULL_LIMIT = entriesCfg.defaultLimit ?? 10;
const CAP_LIMIT = entriesCfg.capLimit ?? 10;
const REQUEST_TIMEOUT_MS = syncCfg.requestTimeoutMs ?? 20000;

// ── Error classification ───────────────────────────────────────────────────

class SyncHttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

async function sendRequest(path, method, body, timeoutMs) {
  let response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      // Always bound the request — a hung fetch must never block the queue.
      signal: AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure / timeout — regular, expected case (stays pending)
    const wrapped = new Error(`Network error: ${err.message}`);
    wrapped.isNetwork = true;
    throw wrapped;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new SyncHttpError(text || `${response.status} ${response.statusText}`, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ── Queue helpers ──────────────────────────────────────────────────────────

/** Append one operation to the queue. Returns the queue entry id. */
export async function enqueueOp(entityType, entityUuid, op, payload) {
  return db.queue.add({
    entityUuid,
    entityType,
    op,
    payload,
    status: QUEUE_STATUS.PENDING,
    retryCount: 0,
    createdAt: Date.now(),
  });
}

/**
 * True if the queue holds any open op for the given entity UUID.
 * With `includeFailed`: also counts `failed` ops — used by the cap eviction,
 * which must never remove entries that are not acked (F4).
 * Pull uses the default (pending/syncing only): `failed` entries are the
 * R1 exception where the server state wins and may overwrite the cache.
 */
export async function hasOpenOp(entityUuid, { includeFailed = false } = {}) {
  const statuses = includeFailed
    ? [QUEUE_STATUS.PENDING, QUEUE_STATUS.SYNCING, QUEUE_STATUS.FAILED]
    : [QUEUE_STATUS.PENDING, QUEUE_STATUS.SYNCING];
  const count = await db.queue
    .where("entityUuid")
    .equals(entityUuid)
    .filter((q) => statuses.includes(q.status))
    .count();
  return count > 0;
}

/** Number of entries with status pending/syncing/failed (drives UI + logout dialog). */
export async function openOpCount() {
  return db.queue
    .where("status")
    .anyOf(QUEUE_STATUS.PENDING, QUEUE_STATUS.SYNCING, QUEUE_STATUS.FAILED)
    .count();
}

/**
 * Reset any leftover `syncing` entries to `pending` (crashed previous run).
 */
async function resetInterruptedSyncs() {
  const interrupted = await db.queue.where("status").equals(QUEUE_STATUS.SYNCING).toArray();
  if (interrupted.length > 0) {
    await db.queue.bulkPut(
      interrupted.map((q) => ({ ...q, status: QUEUE_STATUS.PENDING }))
    );
  }
}

/**
 * Manual recovery (Q8 follow-up): reset failed entries back to pending
 * and push the queue again. Failed entries are never retried automatically.
 */
export async function retryFailedOps() {
  await db.queue
    .where("status")
    .equals(QUEUE_STATUS.FAILED)
    .modify({ status: QUEUE_STATUS.PENDING, retryCount: 0 });
  await processQueue();
}

/**
 * Synced ops are removed from the queue as soon as they are acked.
 * This cleans up any leftovers from older versions that kept them.
 */
export async function cleanupSyncedOps() {
  await db.queue.where("status").equals(QUEUE_STATUS.SYNCED).delete();
}

// ── Push ───────────────────────────────────────────────────────────────────

/**
 * Process the queue serially — one request at a time, in queue order.
 * Independent error handling per entry: a failing entry never aborts
 * processing of the remaining entries.
 *
 * Options:
 *   - timeoutMs: per-request timeout (used by the logout push attempt)
 *   - maxRetries: override the configured retry limit (tests)
 */
export async function processQueue(options = {}) {
  return runQueueOnce(options);
}

// Serialise queue processing: overlapping triggers (new entity while a
// login flow is pushing) must never interleave — queue order is sacred.
let activeRun = Promise.resolve();
async function runQueueOnce(options) {
  const run = () => processQueueLocked(options);
  const next = activeRun.then(run, run);
  activeRun = next.catch(() => {});
  return next;
}

async function processQueueLocked(options) {
  const { timeoutMs, maxRetries = MAX_RETRIES } = options;

  await resetInterruptedSyncs();

  const ops = await db.queue
    .where("status")
    .equals(QUEUE_STATUS.PENDING)
    .sortBy("id");

  for (const op of ops) {
    await db.queue.update(op.id, { status: QUEUE_STATUS.SYNCING });
    try {
      const path = ENTITY_PATHS[op.entityType];
      if (!path) {
        throw new Error(`Unknown entityType: ${op.entityType}`);
      }

      if (op.op === "create") {
        await sendRequest(`/${path}`, "POST", op.payload, timeoutMs);
      } else if (op.op === "update") {
        await sendRequest(`/${path}/${op.entityUuid}`, "PUT", op.payload, timeoutMs);
      } else if (op.op === "delete") {
        await sendRequest(`/${path}/${op.entityUuid}`, "DELETE", undefined, timeoutMs);
      } else {
        throw new Error(`Unknown op: ${op.op}`);
      }

      // Ack received — the op is done; remove it from the queue.
      await db.queue.delete(op.id);
    } catch {
      // Network errors and server errors (4xx) share the same retry-count
      // mechanism — neither aborts the remaining queue entries.
      const retryCount = (op.retryCount ?? 0) + 1;
      const final = retryCount >= maxRetries;
      await db.queue.update(op.id, {
        retryCount,
        status: final ? QUEUE_STATUS.FAILED : QUEUE_STATUS.PENDING,
      });
    }
  }
}

// ── Pull ───────────────────────────────────────────────────────────────────

// Incremented on every clearAll (logout). An in-flight pull checks this
// before writing — otherwise a pull started during a login flow would
// resurrect data right after the logout wiped the cache.
let clearGeneration = 0;

/**
 * Pull the paginated server state into the cache.
 * Entities with open queue ops (pending/syncing) are skipped —
 * the local version stays, the server must not resurrect local deletes.
 */
export async function pull(entriesLimit = PULL_LIMIT) {
  const generationAtStart = clearGeneration;

  const [groupsData, ungroupedData] = await Promise.all([
    fetchPull("/groups/all", entriesLimit),
    fetchPull("/exercises/ungrouped", entriesLimit),
  ]);

  if (generationAtStart !== clearGeneration) {
    // The cache was cleared (logout) while we were fetching — abort.
    console.warn("[sync] pull aborted: cache was cleared during fetch");
    return;
  }

  await db.transaction("rw", db.groups, db.exercises, db.entries, db.queue, async () => {
    for (const g of groupsData || []) {
      if (await hasOpenOp(g.id)) continue;
      const nextGroup = {
        id: g.id,
        name: g.name,
        order: g.order,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      };
      const currentGroup = await db.groups.get(g.id);
      if (
        !currentGroup ||
        currentGroup.name !== nextGroup.name ||
        (currentGroup.order ?? 0) !== nextGroup.order
      ) {
        await db.groups.put(nextGroup);
      }
      for (const ex of g.exercises || []) {
        if (await hasOpenOp(ex.id)) continue;
        await putExercise(ex, g.id);
      }
    }

    for (const ex of ungroupedData || []) {
      if (await hasOpenOp(ex.id)) continue;
      await putExercise(ex, null);
    }
  });
}

async function fetchPull(path, entriesLimit) {
  try {
    return await sendRequest(`${path}?entriesLimit=${entriesLimit}`, "GET");
  } catch (err) {
    // Pull failure must never break the app — data stays local.
    console.error(`[sync] pull failed for ${path}:`, err.message);
    return [];
  }
}

async function putExercise(ex, groupId) {
  const next = {
    id: ex.id,
    name: ex.name,
    order: ex.order ?? 0,
    groupId: groupId ?? null,
    createdAt: ex.createdAt,
    updatedAt: ex.updatedAt,
  };
  const existing = await db.exercises.get(ex.id);
  const changed =
    !existing ||
    existing.name !== next.name ||
    (existing.order ?? 0) !== next.order ||
    (existing.groupId ?? null) !== next.groupId;
  if (changed) {
    await db.exercises.put(next);
  }
  for (const entry of ex.entries || []) {
    if (await hasOpenOp(entry.id)) continue;
    const entryNext = {
      id: entry.id,
      exerciseId: ex.id,
      date: entry.date,
      weight: Number(entry.weight),
      reps: entry.reps,
      note: entry.note ?? "",
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
    const current = await db.entries.get(entry.id);
    const entryChanged =
      !current ||
      current.date !== entryNext.date ||
      Number(current.weight) !== entryNext.weight ||
      current.reps !== entryNext.reps ||
      (current.note ?? "") !== entryNext.note;
    // Skip unchanged rows — avoid IndexedDB churn on every reload.
    if (entryChanged) {
      await db.entries.put(entryNext);
    }
  }
}

/**
 * Full login sequence (section 3.2): push the complete queue first,
 * then pull — in this strict order, so local deletes/changes can never
 * be resurrected by the pull.
 */
export async function loginFlow(entriesLimit = PULL_LIMIT) {
  await processQueue();
  await pull(entriesLimit);
}

// ── Cache cap eviction (section 6) ─────────────────────────────────────────

/**
 * Enforce the per-exercise cap ("max N entries per exercise").
 * Only entries without ANY open queue op are evictable; pending/syncing/
 * failed entries are never touched, regardless of age. Eviction removes
 * the oldest entries by training date first.
 */
export async function applyCapEviction(limit = CAP_LIMIT) {
  const exercises = await db.exercises.toArray();

  for (const exercise of exercises) {
    const entries = await db.entries.where("exerciseId").equals(exercise.id).toArray();
    if (entries.length <= limit) continue;

    const byDateAsc = [...entries].sort((a, b) => {
      const d = String(a.date ?? "").localeCompare(String(b.date ?? ""));
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    });

    let remaining = entries.length;
    for (const entry of byDateAsc) {
      if (remaining <= limit) break;
      // never evict unsynced data — pending/syncing AND failed (F4)
      if (await hasOpenOp(entry.id, { includeFailed: true })) continue;
      await db.entries.delete(entry.id);
      remaining -= 1;
    }
  }
}

// ── Logout cleanup (section 3.3) ───────────────────────────────────────────

/**
 * Wipe the entity cache AND the queue completely. Called after a
 * confirmed logout — everything not synced by then is deliberately
 * discarded. Bumps the generation so in-flight pulls abort.
 */
export async function clearAll() {
  clearGeneration += 1;
  await db.transaction("rw", db.groups, db.exercises, db.entries, db.queue, async () => {
    await Promise.all([
      db.groups.clear(),
      db.exercises.clear(),
      db.entries.clear(),
      db.queue.clear(),
    ]);
  });
}
