// src/db/repositories.js
//
// Pure IndexedDB CRUD operations — no network, no sync.
// All functions return promises and operate on the Dexie-managed tables.
//
// Conventions:
//   - Groups/exercises are sorted by `order` ascending.
//   - Entries are sorted by `date` descending (newest first).
//   - create* functions generate a temp ID so optimistic writes work offline.

import db from "./dexie";
import config from "virtual:app-config";

const { tempIdPrefix } = config.storage;

// ── Helpers ────────────────────────────────────────────────────────────────

function tempId() {
  return `${tempIdPrefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Groups ─────────────────────────────────────────────────────────────────

export async function getAllGroups() {
  const groups = await db.groups.orderBy("order").toArray();
  return groups;
}

export async function getGroup(id) {
  return db.groups.get(id);
}

export async function createGroup({ id, name, order }) {
  const gid = id ?? tempId();
  await db.groups.put({ id: gid, name, order });
  return gid;
}

export async function updateGroupOrder(id, newOrder) {
  await db.groups.update(id, { order: newOrder });
}

export async function deleteGroup(id) {
  await db.groups.delete(id);
}

// ── Exercises ──────────────────────────────────────────────────────────────

export async function getAllExercises() {
  const exercises = await db.exercises.orderBy("order").toArray();
  // Attach entries to each exercise (sorted by date desc)
  return Promise.all(exercises.map(attachEntries));
}

export async function getUngroupedExercises() {
  const exercises = await db.exercises.toCollection()
    .filter((ex) => !ex.groupId)
    .sortBy("order");
  return Promise.all(exercises.map(attachEntries));
}

export async function getExercisesByGroup(groupId) {
  const exercises = await db.exercises
    .where("groupId")
    .equals(groupId)
    .sortBy("order");
  return Promise.all(exercises.map(attachEntries));
}

async function attachEntries(exercise) {
  const entries = await db.entries
    .where("exerciseId")
    .equals(exercise.id)
    .reverse()
    .sortBy("date");
  return { ...exercise, entries };
}

export async function createExercise({ id, name, order, groupId }) {
  const eid = id ?? tempId();
  await db.exercises.put({ id: eid, name, order: order ?? 0, groupId: groupId ?? null });
  return eid;
}

export async function updateExerciseOrder(id, groupId, order) {
  await db.exercises.update(id, { groupId: groupId ?? null, order });
}

export async function deleteExercise(id) {
  // Delete all child entries in a transaction
  await db.transaction("rw", [db.exercises, db.entries], async () => {
    await db.entries.where("exerciseId").equals(id).delete();
    await db.exercises.delete(id);
  });
}

// ── Entries ────────────────────────────────────────────────────────────────

export async function getEntriesByExercise(exerciseId) {
  return db.entries
    .where("exerciseId")
    .equals(exerciseId)
    .reverse()
    .sortBy("date");
}

export async function createEntry({ id, date, weight, reps, note, exerciseId }) {
  const eid = id ?? tempId();
  await db.entries.put({
    id: eid,
    date,
    weight: Number(weight),
    reps: Number(reps),
    note: note ?? "",
    exerciseId,
  });
  return eid;
}

export async function deleteEntry(id) {
  await db.entries.delete(id);
}

// ── Bulk operations (for import / refresh) ─────────────────────────────────

export async function replaceAllData(groupsData, exercisesData) {
  await db.transaction("rw", [db.groups, db.exercises, db.entries], async () => {
    await db.groups.clear();
    await db.exercises.clear();
    await db.entries.clear();

    for (const g of groupsData) {
      await db.groups.put({ id: g.id, name: g.name, order: g.order });
    }

    for (const ex of exercisesData) {
      await db.exercises.put({
        id: ex.id,
        name: ex.name,
        order: ex.order ?? 0,
        groupId: ex.groupId ?? null,
      });
      for (const entry of ex.entries || []) {
        await db.entries.put({
          id: entry.id,
          date: entry.date,
          weight: Number(entry.weight),
          reps: Number(entry.reps),
          note: entry.note ?? "",
          exerciseId: ex.id,
        });
      }
    }
  });
}

// ── ID mapping helpers ─────────────────────────────────────────────────────

export async function replaceTempId(tableName, tempId, realId) {
  const table = db.table(tableName);
  const record = await table.get(tempId);
  if (!record) return;

  await db.transaction("rw", [table, db.entries, db.syncQueue], async () => {
    // Insert with real ID
    await table.put({ ...record, id: realId });
    // Remove temp record
    await table.delete(tempId);

    // Update foreign keys in entries
    if (tableName === "exercises") {
      const childEntries = await db.entries.where("exerciseId").equals(tempId).toArray();
      for (const e of childEntries) {
        await db.entries.put({ ...e, exerciseId: realId });
      }
      // Also update any entries that somehow still reference the temp exerciseId
      await db.entries.where("exerciseId").equals(tempId).modify({ exerciseId: realId });
    }
  });
}

export { tempId, tempIdPrefix as TEMP_PREFIX };
