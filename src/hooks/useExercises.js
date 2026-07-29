// src/hooks/useExercises.js
//
// Server-first data hook — fetches all data from the backend on mount
// and on auth changes. Mutations go directly to the backend API.
// No IndexedDB, no sync queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { useAuth } from "../auth/AuthContext";
import config from "virtual:app-config";

const { entries: entriesCfg } = config;

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchFromServer() {
  const [groupsData, ungroupedData] = await Promise.all([
    api.get(`/groups/all?entriesLimit=${entriesCfg.defaultLimit}`),
    api.get(`/exercises/ungrouped?entriesLimit=${entriesCfg.defaultLimit}`),
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
  const [exercises, setExercises] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { authenticated } = useAuth();

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFromServer();
      setGroups(data.groups);
      setExercises(data.exercises);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  // Load data on mount and when auth state changes
  const wasAuthenticated = useRef(authenticated);
  useEffect(() => {
    if (authenticated) {
      refresh();
    } else {
      setExercises([]);
      setGroups([]);
    }
    wasAuthenticated.current = authenticated;
  }, [authenticated, refresh]);

  // ── Exercise mutations ──────────────────────────────────────────────────

  const addExercise = useCallback(async (name, groupId = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const order = exercises.filter(
      (ex) => (ex.groupId ?? null) === (groupId ?? null)
    ).length;

    await api.post("/exercises", {
      name: trimmed,
      order,
      groupId: groupId || null,
    });

    await refresh();
  }, [exercises, refresh]);

  const deleteExercise = useCallback(async (exerciseId) => {
    await api.delete(`/exercises/${exerciseId}`);
    await refresh();
  }, [refresh]);

  const moveExercise = useCallback(async (exerciseId, targetGroupId, targetIndex) => {
    await api.put("/exercises/reorder", {
      exerciseId,
      targetGroupId: targetGroupId ?? null,
      newOrder: targetIndex,
    });
    await refresh();
  }, [refresh]);

  // ── Group mutations ─────────────────────────────────────────────────────

  const addGroup = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    await api.post("/groups", {
      name: trimmed,
      order: groups.length,
    });
    await refresh();
  }, [groups, refresh]);

  const deleteGroup = useCallback(async (groupId) => {
    await api.delete(`/groups/${groupId}`);
    await refresh();
  }, [refresh]);

  const reorderGroups = useCallback(async (orderedIds) => {
    const currentOrder = new Map(groups.map((g) => [g.id, g.order]));
    const changes = orderedIds
      .map((id, newOrder) => ({ id, newOrder, oldOrder: currentOrder.get(id) }))
      .filter((c) => c.oldOrder !== c.newOrder && c.oldOrder != null);

    for (const { id, newOrder } of changes) {
      await api.put("/groups/reorder", { groupId: id, newOrder });
    }
    await refresh();
  }, [groups, refresh]);

  // ── Entry mutations ─────────────────────────────────────────────────────

  const addEntry = useCallback(async (exerciseId, date, weight, reps, note = "") => {
    if (!date || weight == null || reps == null) return;

    await api.post("/entries", {
      date,
      weight: Number(weight),
      reps: Number(reps),
      note: (note ?? "").trim(),
      exerciseId,
    });
    await refresh();
  }, [refresh]);

  const deleteEntry = useCallback(async (_exerciseId, entry) => {
    if (!entry?.id) return;
    await api.delete(`/entries/${entry.id}`);
    await refresh();
  }, [refresh]);

  // ── Load more entries ───────────────────────────────────────────────────

  const loadMoreEntries = useCallback(async (exerciseId) => {
    const page = await api.get(
      `/exercises/${exerciseId}/entries?offset=0&limit=${entriesCfg.loadMoreLimit}`
    );
    return page.totalCount;
  }, []);

  // ── Bulk import ─────────────────────────────────────────────────────────

  const importData = useCallback(async (data) => {
    if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.groups)) {
      throw new Error("Invalid import format – expected { exercises, groups }");
    }

    const groupIdMap = new Map();
    for (const g of data.groups || []) {
      const created = await api.post("/groups", { name: g.name, order: g.order });
      groupIdMap.set(g.id, created.id);
    }

    for (const ex of data.exercises || []) {
      const groupId = ex.groupId ? (groupIdMap.get(ex.groupId) ?? null) : null;
      const created = await api.post("/exercises", {
        name: ex.name,
        order: ex.order ?? 0,
        groupId,
      });

      for (const entry of ex.entries || []) {
        await api.post("/entries", {
          date: entry.date,
          weight: Number(entry.weight),
          reps: Number(entry.reps),
          note: entry.note ?? "",
          exerciseId: created.id,
        });
      }
    }

    await refresh();
  }, [refresh]);

  return {
    exercises,
    groups,
    syncing: loading,
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
