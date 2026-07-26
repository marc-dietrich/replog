// src/hooks/useExercises.js
//
// Local-first data hook — reads from IndexedDB (instant, offline-capable),
// writes optimistically to IndexedDB, then syncs to the backend in the background.
//
// Public API is identical to the old server-first version, plus:
//   loadMoreEntries(exerciseId) — fetch all entries for a specific exercise

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getAllGroups,
  getAllExercises,
  createGroup,
  deleteGroup,
  updateGroupOrder,
  createExercise,
  deleteExercise,
  updateExerciseOrder,
  createEntry,
  deleteEntry,
  replaceAllData,
} from "../db/repositories";
import {
  addToQueue,
  processQueue,
  startPeriodicRetry,
  stopPeriodicRetry,
} from "../sync/queue";
import config from "virtual:app-config";

const { apiBase, entries: entriesCfg, sync: syncCfg } = config;

// ── Server fetch helpers ───────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${apiBase}${path}`;
  const config = {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function fetchFromServer() {
  const [groupsData, ungroupedData] = await Promise.all([
    apiFetch(`/groups/all?entriesLimit=${entriesCfg.defaultLimit}`),
    apiFetch(`/exercises/ungrouped?entriesLimit=${entriesCfg.defaultLimit}`),
  ]);
  return flattenResponse(groupsData, ungroupedData);
}

function flattenResponse(groupsData, ungroupedData) {
  const groups = [];
  const exercises = [];

  for (const g of groupsData || []) {
    groups.push({ id: g.id, name: g.name, order: g.order });
    for (const ex of g.exercises || []) {
      exercises.push(normaliseExercise(ex, g.id));
    }
  }

  for (const ex of ungroupedData || []) {
    exercises.push(normaliseExercise(ex, null));
  }

  return { groups, exercises };
}

function normaliseExercise(ex, groupId) {
  return {
    id: ex.id,
    name: ex.name,
    order: ex.order ?? 0,
    groupId: groupId ?? null,
    entries: (ex.entries || []).map((e) => ({
      id: e.id,
      date: e.date,
      weight: Number(e.weight),
      reps: e.reps,
      note: e.note ?? "",
    })),
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExercises() {
  // Reactively read from IndexedDB — updates automatically on any change
  const exercisesLive = useLiveQuery(() => getAllExercises(), []);
  const groupsLive = useLiveQuery(() => getAllGroups(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derived data — use live data if available, otherwise empty
  const exercises = exercisesLive ?? [];
  const groups = groupsLive ?? [];

  // ── Initial load: fetch from server and populate IndexedDB ────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFromServer();
      await replaceAllData(data.groups, data.exercises);
      // After replacing, try to sync any queued changes
      processQueue();
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    startPeriodicRetry(syncCfg.retryIntervalMs);
    return () => stopPeriodicRetry();
  }, [refresh]);

  // ── Exercise mutations ──────────────────────────────────────────────────

  const addExercise = useCallback(async (name, groupId = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const order = exercises.filter(
      (ex) => (ex.groupId ?? null) === (groupId ?? null)
    ).length;

    // Optimistic: write to IndexedDB immediately
    const id = await createExercise({ name: trimmed, order, groupId });

    // Enqueue sync to backend
    await addToQueue("exercise", id, "create", {
      name: trimmed,
      order,
      groupId: groupId || null,
    });
    processQueue();
  }, [exercises]);

  const deleteExercise = useCallback(async (exerciseId) => {
    await deleteExercise(exerciseId);
    await addToQueue("exercise", exerciseId, "delete", null);
    processQueue();
  }, []);

  const moveExercise = useCallback(async (exerciseId, targetGroupId, targetIndex) => {
    await updateExerciseOrder(exerciseId, targetGroupId, targetIndex);
    await addToQueue("exerciseReorder", exerciseId, "update", {
      exerciseId,
      targetGroupId: targetGroupId ?? null,
      newOrder: targetIndex,
    });
    processQueue();
  }, []);

  // ── Group mutations ─────────────────────────────────────────────────────

  const addGroup = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const id = await createGroup({ name: trimmed, order: groups.length });
    await addToQueue("group", id, "create", {
      name: trimmed,
      order: groups.length,
    });
    processQueue();
  }, [groups]);

  const deleteGroup = useCallback(async (groupId) => {
    await deleteGroup(groupId);
    await addToQueue("group", groupId, "delete", null);
    processQueue();
  }, []);

  const reorderGroups = useCallback(async (orderedIds) => {
    // Update local order immediately
    for (let i = 0; i < orderedIds.length; i++) {
      await updateGroupOrder(orderedIds[i], i);
    }

    // Enqueue one reorder per changed group
    const currentOrder = new Map(groups.map((g) => [g.id, g.order]));
    const changes = orderedIds
      .map((id, newOrder) => ({ id, newOrder, oldOrder: currentOrder.get(id) }))
      .filter((c) => c.oldOrder !== c.newOrder && c.oldOrder != null)
      .sort((a, b) => a.newOrder - b.newOrder);

    for (const { id, newOrder } of changes) {
      await addToQueue("groupReorder", id, "update", {
        groupId: id,
        newOrder,
      });
    }
    processQueue();
  }, [groups]);

  // ── Entry mutations ─────────────────────────────────────────────────────

  const addEntry = useCallback(async (exerciseId, date, weight, reps, note = "") => {
    if (!date || weight == null || reps == null) return;

    const id = await createEntry({
      date,
      weight: Number(weight),
      reps: Number(reps),
      note: (note ?? "").trim(),
      exerciseId,
    });

    await addToQueue("entry", id, "create", {
      date,
      weight: Number(weight),
      reps: Number(reps),
      note: (note ?? "").trim(),
      exerciseId,
    });
    processQueue();
  }, []);

  const deleteEntry = useCallback(async (_exerciseId, entry) => {
    if (!entry?.id) return;
    await deleteEntry(entry.id);
    await addToQueue("entry", entry.id, "delete", null);
    processQueue();
  }, []);

  // ── Load more entries for a specific exercise ────────────────────────────

  const loadMoreEntries = useCallback(async (exerciseId) => {
    const page = await apiFetch(
      `/exercises/${exerciseId}/entries?offset=0&limit=${entriesCfg.loadMoreLimit}`
    );
    // Merge into IndexedDB — useLiveQuery will pick up the changes
    const { entries: allEntries } = page;
    for (const entry of allEntries) {
      await createEntry({
        id: entry.id,
        date: entry.date,
        weight: Number(entry.weight),
        reps: entry.reps,
        note: entry.note ?? "",
        exerciseId,
      });
    }
    return page.totalCount;
  }, []);

  // ── Bulk import ─────────────────────────────────────────────────────────

  const importData = useCallback(async (data) => {
    if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.groups)) {
      throw new Error("Invalid import format – expected { exercises, groups }");
    }

    // 1. Create groups locally (with temp IDs that map to originals)
    const groupIdMap = new Map();
    for (const g of data.groups || []) {
      const id = await createGroup({ name: g.name, order: g.order });
      groupIdMap.set(g.id, id);
      await addToQueue("group", id, "create", { name: g.name, order: g.order });
    }

    // 2. Create exercises & their entries
    const ungrouped = (data.exercises || []).filter((ex) => !ex.groupId);
    const grouped = (data.exercises || []).filter((ex) => !!ex.groupId);
    for (const ex of [...grouped, ...ungrouped]) {
      const mappedGroupId = ex.groupId ? (groupIdMap.get(ex.groupId) ?? null) : null;
      const exId = await createExercise({
        name: ex.name,
        order: ex.order ?? 0,
        groupId: mappedGroupId,
      });
      await addToQueue("exercise", exId, "create", {
        name: ex.name,
        order: ex.order ?? 0,
        groupId: mappedGroupId,
      });

      for (const entry of ex.entries || []) {
        const entryId = await createEntry({
          date: entry.date,
          weight: Number(entry.weight),
          reps: Number(entry.reps),
          note: entry.note ?? "",
          exerciseId: exId,
        });
        await addToQueue("entry", entryId, "create", {
          date: entry.date,
          weight: Number(entry.weight),
          reps: Number(entry.reps),
          note: entry.note ?? "",
          exerciseId: exId,
        });
      }
    }

    processQueue();
  }, []);

  return {
    exercises,
    groups,
    loading,
    error,
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

