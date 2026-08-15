// src/db/db.js
//
// Dexie database — the primary local datastore (the "Cache" per spec).
// Two logical stores live in the same DB:
//   • Entity stores (groups, exercises, entries) — the actual data
//   • `queue` — append-only op log of sync operations ("Queue" per spec)
//
// IDs are always client-generated UUIDs. Timestamps (createdAt/updatedAt)
// always come from the client device.

import Dexie from "dexie";

export const db = new Dexie("replog-local-first");

db.version(1).stores({
  groups: "id, name, order, createdAt, updatedAt",
  exercises: "id, name, order, groupId, createdAt, updatedAt",
  entries: "id, exerciseId, date, weight, reps, note, createdAt, updatedAt",
  queue: "++id, entityUuid, entityType, op, status, retryCount, createdAt",
});

export const QUEUE_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed",
};

export const ENTITY_TYPE = {
  GROUP: "group",
  EXERCISE: "exercise",
  ENTRY: "entry",
};

// Plural path segment used for the REST API
export const ENTITY_PATHS = {
  [ENTITY_TYPE.GROUP]: "groups",
  [ENTITY_TYPE.EXERCISE]: "exercises",
  [ENTITY_TYPE.ENTRY]: "entries",
};

/** Generate a client-side UUID (v4), with fallback for older browsers. */
export function newUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122-ish v4 from Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** ISO-8601 timestamp from the client device clock. */
export function nowIso() {
  return new Date().toISOString();
}
