// src/sync/queue.js
//
// Sync queue manager.
// After every optimistic write to IndexedDB, a corresponding row is added here.
// processQueue() pushes pending items to the backend and handles retries.
//
// The queue is health-aware — it won't attempt sync if the backend is down.

import db from "../db/dexie";
import { replaceTempId, TEMP_PREFIX } from "../db/repositories";
import config from "virtual:app-config";
import { getToken } from "../auth/keycloak";

const { apiBase, sync: syncCfg, health: healthCfg } = config;

// ── Internal fetch ─────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${apiBase}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const config = { headers, ...options };

  const response = await fetch(url, config);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = body || `${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return null;
  return response.json();
}

// ── Health check (lightweight, no side effects) ────────────────────────────

let lastHealthStatus = "unknown";
let lastHealthCheck = 0;

export async function checkHealth() {
  const now = Date.now();

  if (!navigator.onLine) {
    lastHealthStatus = "offline";
    lastHealthCheck = now;
    return "offline";
  }

  // Don't cache if previously offline — online status can change fast
  if (lastHealthStatus === "offline") {
    lastHealthStatus = "unknown";
    lastHealthCheck = 0;
  }

  if (now - lastHealthCheck < healthCfg.cacheMs) {
    return lastHealthStatus;
  }
  lastHealthCheck = now;

  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(healthCfg.fetchTimeoutMs) });
    const data = await res.json();
    lastHealthStatus = data.db === "UP" ? "up" : "db-down";
    return lastHealthStatus;
  } catch {
    lastHealthStatus = "down";
    return "down";
  }
}

export function getLastHealthStatus() {
  return lastHealthStatus;
}

export function resetHealthCache() {
  lastHealthStatus = "unknown";
  lastHealthCheck = 0;
}

export function canSync() {
  return lastHealthStatus === "up";
}

// ── Queue operations ───────────────────────────────────────────────────────

export async function addToQueue(entityType, entityId, operation, payload) {
  await db.syncQueue.put({
    entityType,
    entityId,
    operation,
    payload: payload ?? null,
    timestamp: Date.now(),
    retries: 0,
    lastError: null,
  });
}

export async function getPendingCount() {
  return db.syncQueue.count();
}

// ── Processing ─────────────────────────────────────────────────────────────

let processing = false;

export async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    const health = await checkHealth();
    if (health !== "up") {
      return; // backend or db is down — don't waste attempts
    }

    const pending = await db.syncQueue.orderBy("timestamp").toArray();

    for (const item of pending) {
      const delay = Math.min(syncCfg.baseDelayMs * Math.pow(2, item.retries), syncCfg.maxDelayMs);
      const elapsed = Date.now() - item.timestamp;
      if (elapsed < delay && item.retries > 0) {
        continue; // exponential backoff not yet elapsed
      }

      try {
        const result = await executeSyncItem(item);

        // On success: map temp ID → real ID if needed
        if (item.entityId.startsWith(TEMP_PREFIX) && result?.id) {
          await replaceTempId(item.entityType + "s", item.entityId, result.id);
        }

        // Remove from queue
        await db.syncQueue.where("localId").equals(item.localId).delete();
      } catch (err) {
        const status = err.status ?? 0;

        if (status >= 400 && status < 500) {
          // Client error (validation, not found) — can't recover, drop it
          console.warn(`Sync: dropping ${item.operation} ${item.entityType} — ${err.message}`);
          await db.syncQueue.where("localId").equals(item.localId).delete();
        } else {
          // Network or server error — retry later
          const newRetries = item.retries + 1;
          if (newRetries > syncCfg.maxRetries) {
            console.error(`Sync: max retries exceeded for ${item.operation} ${item.entityType}`);
            await db.syncQueue.where("localId").equals(item.localId).delete();
          } else {
            await db.syncQueue.update(item.localId, {
              retries: newRetries,
              lastError: err.message,
            });
          }
        }
      }
    }
  } finally {
    processing = false;
  }
}

async function executeSyncItem(item) {
  switch (item.entityType) {
    case "group":
      if (item.operation === "create") {
        return apiFetch("/groups", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });
      }
      if (item.operation === "delete") {
        return apiFetch(`/groups/${item.entityId}`, { method: "DELETE" });
      }
      break;

    case "exercise":
      if (item.operation === "create") {
        return apiFetch("/exercises", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });
      }
      if (item.operation === "delete") {
        return apiFetch(`/exercises/${item.entityId}`, { method: "DELETE" });
      }
      break;

    case "entry":
      if (item.operation === "create") {
        // Map temp exerciseId to real one if already synced
        const payload = { ...item.payload };
        if (payload.exerciseId?.startsWith(TEMP_PREFIX)) {
          // If the parent exercise hasn't been synced yet, skip this entry for now
          return null;
        }
        return apiFetch("/entries", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      if (item.operation === "delete") {
        return apiFetch(`/entries/${item.entityId}`, { method: "DELETE" });
      }
      break;

    case "exerciseReorder":
      if (item.operation === "update") {
        return apiFetch("/exercises/reorder", {
          method: "PUT",
          body: JSON.stringify(item.payload),
        });
      }
      break;

    case "groupReorder":
      if (item.operation === "update") {
        return apiFetch("/groups/reorder", {
          method: "PUT",
          body: JSON.stringify(item.payload),
        });
      }
      break;
  }
  return null;
}

// ── Periodic retry ─────────────────────────────────────────────────────────

let retryTimer = null;

export function startPeriodicRetry(intervalMs = syncCfg.retryIntervalMs) {
  stopPeriodicRetry();
  retryTimer = setInterval(async () => {
    const count = await getPendingCount();
    if (count > 0) {
      await processQueue();
    }
  }, intervalMs);
}

export function stopPeriodicRetry() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}
