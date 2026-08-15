// src/hooks/useExercises.js
//
// Local-first data hook. IndexedDB (Dexie) is the primary datastore:
// mutations write to the cache immediately and enqueue a queue op.
// The sync engine pushes in the background whenever a session exists.
// `useLiveQuery` makes the hook reactive — no manual refetch needed.

import { useCallback, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newUuid, nowIso } from "../db/db";
import {
  applyCapEviction,
  enqueueOp,
  processQueue,
} from "../db/sync";
import { api } from "./api/client";
import { useAuth } from "../auth/AuthContext";
import config from "virtual:app-config";

const { entries: entriesCfg } = config;

function sortByDateAsc(a, b) {
  const da = String(a.date ?? "");
  const dbDate = String(b.date ?? "");
  if (da < dbDate) return -1;
  if (da > dbDate) return 1;
  return 0;
}

/**
 * Kick off a background sync attempt after a local mutation.
 * Only when a session exists — anonymous entries just stay pending.
 */
function triggerSync(authenticated) {
  if (!authenticated) return;
  processQueue().catch((err) => console.error("[sync] push failed:", err));
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExercises() {
  const { authenticated } = useAuth();

  const groupsRaw = useLiveQuery(() => db.groups.toArray(), []);
  const exercisesRaw = useLiveQuery(() => db.exercises.toArray(), []);
  const entriesRaw = useLiveQuery(() => db.entries.toArray(), []);

  // Enforce the per-exercise cache cap once on app start (section 6).
  useEffect(() => {
    applyCapEviction().catch((err) =>
      console.error("[cap] eviction failed:", err)
    );
  }, []);

  const groups = useMemo(
    () =>
      (groupsRaw ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        order: g.order,
      })),
    [groupsRaw]
  );

  const exercises = useMemo(() => {
    const entriesByExercise = new Map();
    for (const entry of entriesRaw ?? []) {
      if (!entriesByExercise.has(entry.exerciseId)) {
        entriesByExercise.set(entry.exerciseId, []);
      }
      entriesByExercise.get(entry.exerciseId).push(entry);
    }
    for (const list of entriesByExercise.values()) {
      list.sort(sortByDateAsc);
    }

    return (exercisesRaw ?? []).map((ex) => ({
      id: ex.id,
      name: ex.name,
      order: ex.order ?? 0,
      groupId: ex.groupId ?? null,
      entries: entriesByExercise.get(ex.id) ?? [],
    }));
  }, [exercisesRaw, entriesRaw]);

  // refresh(): local re-read only — no server call, no pull (G3).
  // With useLiveQuery the reads are already reactive; this stays for
  // API compatibility with existing call sites.
  const refresh = useCallback(async () => {
    await db.groups.toArray();
    await db.exercises.toArray();
    await db.entries.toArray();
  }, []);

  // ── Exercise mutations ──────────────────────────────────────────────────

  const addExercise = useCallback(async (name, groupId = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = await db.exercises.toArray();
    const order = existing.filter(
      (ex) => (ex.groupId ?? null) === (groupId ?? null)
    ).length;

    const entity = {
      id: newUuid(),
      name: trimmed,
      order,
      groupId: groupId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.exercises.add(entity);
    await enqueueOp("exercise", entity.id, "create", entity);
    triggerSync(authenticated);
  }, [authenticated]);

  const deleteExercise = useCallback(async (exerciseId) => {
    if (!exerciseId) return;
    await db.transaction("rw", db.exercises, db.entries, async () => {
      await db.exercises.delete(exerciseId);
      await db.entries.where("exerciseId").equals(exerciseId).delete();
    });
    await enqueueOp("exercise", exerciseId, "delete", null);
    triggerSync(authenticated);
  }, [authenticated]);

  const moveExercise = useCallback(async (exerciseId, targetGroupId, targetIndex) => {
    const all = await db.exercises.toArray();
    const moved = all.find((ex) => ex.id === exerciseId);
    if (!moved) return;

    const now = nowIso();
    const oldGroupId = moved.groupId ?? null;
    const newGroupId = targetGroupId ?? null;

    // Collect exercises whose final state differs; moved exercise gets its
    // new group/order, siblings get renumbered orders (mirrors backend).
    const updated = [];
    const recordChanged = (ex, order) => {
      const changed =
        ex.id === moved.id
          ? (ex.groupId ?? null) !== newGroupId || (ex.order ?? 0) !== order
          : (ex.order ?? 0) !== order;
      if (changed) {
        updated.push({ ...ex, order, groupId: ex.id === moved.id ? newGroupId : ex.groupId, updatedAt: now });
      }
    };

    const others = all.filter((ex) => ex.id !== exerciseId);
    const byGroup = (groupId) =>
      others
        .filter((ex) => (ex.groupId ?? null) === groupId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (oldGroupId === newGroupId) {
      const members = byGroup(newGroupId);
      const idx = Math.max(0, Math.min(targetIndex, members.length));
      members.splice(idx, 0, moved);
      members.forEach(recordChanged);
    } else {
      // Close the gap in the old group
      byGroup(oldGroupId).forEach(recordChanged);

      // Make room in the target group and insert the moved exercise
      const target = byGroup(newGroupId);
      const idx = Math.max(0, Math.min(targetIndex, target.length));
      target.splice(idx, 0, moved);
      target.forEach(recordChanged);
    }

    await db.transaction("rw", db.exercises, async () => {
      for (const ex of updated) {
        await db.exercises.put(ex);
      }
    });

    // One update op per changed exercise (Q4: full new state, no new op type)
    for (const ex of updated) {
      await enqueueOp("exercise", ex.id, "update", ex);
    }
    triggerSync(authenticated);
  }, [authenticated]);

  // ── Group mutations ─────────────────────────────────────────────────────

  const addGroup = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const entity = {
      id: newUuid(),
      name: trimmed,
      order: await db.groups.count(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.groups.add(entity);
    await enqueueOp("group", entity.id, "create", entity);
    triggerSync(authenticated);
  }, [authenticated]);

  const deleteGroup = useCallback(async (groupId) => {
    if (!groupId) return;
    // Exercises stay and become ungrouped (matches backend behaviour)
    await db.transaction("rw", db.groups, db.exercises, async () => {
      await db.groups.delete(groupId);
      const inGroup = await db.exercises.where("groupId").equals(groupId).toArray();
      const now = nowIso();
      for (const ex of inGroup) {
        await db.exercises.put({ ...ex, groupId: null, updatedAt: now });
      }
    });
    await enqueueOp("group", groupId, "delete", null);
    triggerSync(authenticated);
  }, [authenticated]);

  const reorderGroups = useCallback(async (orderedIds) => {
    const allGroups = await db.groups.toArray();
    const updated = [];
    const now = nowIso();
    orderedIds.forEach((id, order) => {
      const group = allGroups.find((g) => g.id === id);
      if (group && (group.order ?? 0) !== order) {
        updated.push({ ...group, order, updatedAt: now });
      }
    });

    await db.transaction("rw", db.groups, async () => {
      for (const g of updated) {
        await db.groups.put(g);
      }
    });

    for (const g of updated) {
      await enqueueOp("group", g.id, "update", g);
    }
    triggerSync(authenticated);
  }, [authenticated]);

  // ── Entry mutations ─────────────────────────────────────────────────────

  const addEntry = useCallback(async (exerciseId, date, weight, reps, note = "") => {
    if (!exerciseId || !date || weight == null || reps == null) return;

    const entity = {
      id: newUuid(),
      exerciseId,
      date,
      weight: Number(weight),
      reps: Number(reps),
      note: (note ?? "").trim(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.entries.add(entity);
    await enqueueOp("entry", entity.id, "create", entity);
    triggerSync(authenticated);
  }, [authenticated]);

  const deleteEntry = useCallback(async (_exerciseId, entry) => {
    if (!entry?.id) return;
    await db.entries.delete(entry.id);
    await enqueueOp("entry", entry.id, "delete", null);
    triggerSync(authenticated);
  }, [authenticated]);

  // ── Load more entries (explicit user action, not a sync pull — R3) ─────

  const loadMoreEntries = useCallback(async (exerciseId) => {
    const page = await api.get(
      `/exercises/${exerciseId}/entries?offset=0&limit=${entriesCfg.loadMoreLimit}`
    );
    return {
      entries: page.entries ?? [],
      totalCount: page.totalCount ?? 0,
    };
  }, []);

  // ── Bulk import (Q10: write to cache first, then one op per entity) ────

  const importData = useCallback(async (data) => {
    if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.groups)) {
      throw new Error("Invalid import format – expected { exercises, groups }");
    }

    const now = nowIso();
    const groupIdMap = new Map();
    const newGroups = [];
    const newExercises = [];
    const newEntries = [];

    for (const g of data.groups ?? []) {
      const id = newUuid();
      const entity = {
        id,
        name: g.name,
        order: g.order ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      groupIdMap.set(g.id, id);
      newGroups.push(entity);
    }

    for (const ex of data.exercises ?? []) {
      const id = newUuid();
      const groupId = ex.groupId
        ? (groupIdMap.get(ex.groupId) ?? null)
        : null;
      const entity = {
        id,
        name: ex.name,
        order: ex.order ?? 0,
        groupId,
        createdAt: now,
        updatedAt: now,
      };
      newExercises.push(entity);

      for (const entry of ex.entries ?? []) {
        newEntries.push({
          id: newUuid(),
          exerciseId: id,
          date: entry.date,
          weight: Number(entry.weight),
          reps: Number(entry.reps),
          note: entry.note ?? "",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Step 1: write everything into the cache
    await db.transaction("rw", db.groups, db.exercises, db.entries, async () => {
      await db.groups.bulkAdd(newGroups);
      await db.exercises.bulkAdd(newExercises);
      await db.entries.bulkAdd(newEntries);
    });

    // Step 2: one create op per entity (serially processed like any other op)
    for (const g of newGroups) {
      await enqueueOp("group", g.id, "create", g);
    }
    for (const ex of newExercises) {
      await enqueueOp("exercise", ex.id, "create", ex);
    }
    for (const entry of newEntries) {
      await enqueueOp("entry", entry.id, "create", entry);
    }
    triggerSync(authenticated);
  }, [authenticated]);

  return {
    exercises,
    groups,
    syncing: false,
    error: null,
    refresh,
    addExercise,
    addGroup,
    addEntry,
    deleteEntry,
    deleteExercise,
    deleteGroup,
    moveExercise,
    reorderGroups,
    importData,
    loadMoreEntries,
  };
}
