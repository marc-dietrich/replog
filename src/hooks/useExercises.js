// src/hooks/useExercises.js
import { useEffect, useState } from "react";

const STORAGE_KEY = "gym-tracker-exercises";
const EXERCISE_VIEW_MODES = Object.freeze({
  TOP_SET: "topSet",
  VOLUME: "volume",
  SETS: "sets",
});
const DEFAULT_SETTINGS = Object.freeze({
  exerciseViewMode: EXERCISE_VIEW_MODES.TOP_SET,
});
const DEFAULT_STATE = Object.freeze({ exercises: [], groups: [], settings: DEFAULT_SETTINGS });

const normalizeGroupId = (groupId) => (groupId == null ? null : groupId);
const isValidExerciseViewMode = (value) => Object.values(EXERCISE_VIEW_MODES).includes(value);

const isLegacyState = (raw) => {
  if (!raw) return true;
  if (Array.isArray(raw)) return true;
  if (!Array.isArray(raw.groups)) return true;
  if (!Array.isArray(raw.exercises)) return true;
  if (!isValidExerciseViewMode(raw?.settings?.exerciseViewMode)) return true;
  return raw.exercises.some((exercise) => typeof exercise.order !== "number");
};

const normalizeState = (raw) => {
  if (!raw) return DEFAULT_STATE;

  if (Array.isArray(raw)) {
    return {
      exercises: raw.map((exercise, index) => ({
        ...exercise,
        groupId: normalizeGroupId(exercise.groupId),
        order: typeof exercise.order === "number" ? exercise.order : index,
        entries: Array.isArray(exercise.entries) ? exercise.entries : [],
      })),
      groups: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((exercise, index) => ({
        ...exercise,
        groupId: normalizeGroupId(exercise.groupId),
        order: typeof exercise.order === "number" ? exercise.order : index,
        entries: Array.isArray(exercise.entries) ? exercise.entries : [],
      }))
    : [];

  const groups = Array.isArray(raw.groups)
    ? raw.groups.map((group, index) => ({
        id: group.id ?? `group-${index}`,
        name: group.name ?? `Group ${index + 1}`,
        order: typeof group.order === "number" ? group.order : index,
      }))
    : [];

  const settings = {
    exerciseViewMode: isValidExerciseViewMode(raw?.settings?.exerciseViewMode)
      ? raw.settings.exerciseViewMode
      : EXERCISE_VIEW_MODES.TOP_SET,
  };

  return { exercises, groups, settings };
};

const ensureSequentialExerciseOrder = (exercises) => {
  const grouped = new Map();
  exercises.forEach((exercise) => {
    const key = normalizeGroupId(exercise.groupId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(exercise);
  });

  const orderLookup = new Map();
  grouped.forEach((list) => {
    list
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((exercise, index) => orderLookup.set(exercise.id, index));
  });

  return exercises.map((exercise) => ({
    ...exercise,
    order: orderLookup.get(exercise.id) ?? 0,
  }));
};

const ensureSequentialGroupOrder = (groups) =>
  groups
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group, index) => ({ ...group, order: index }));

const hydrateState = (raw) => {
  const normalized = normalizeState(raw);
  return {
    exercises: ensureSequentialExerciseOrder(normalized.exercises),
    groups: ensureSequentialGroupOrder(normalized.groups),
    settings: normalized.settings,
  };
};

const getOrderedExerciseIds = (exercises, groupId) =>
  exercises
    .filter((exercise) => normalizeGroupId(exercise.groupId) === normalizeGroupId(groupId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((exercise) => exercise.id);

const applyExerciseOrder = (exercises, groupId, orderedIds) => {
  const lookup = new Map(orderedIds.map((id, index) => [id, index]));
  return exercises.map((exercise) => {
    if (normalizeGroupId(exercise.groupId) !== normalizeGroupId(groupId)) {
      return exercise;
    }
    const nextOrder = lookup.get(exercise.id);
    return typeof nextOrder === "number" ? { ...exercise, order: nextOrder } : exercise;
  });
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function useExercises() {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : DEFAULT_STATE;
      const normalized = hydrateState(parsed);

      if (stored && isLegacyState(parsed)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }

      return normalized;
    } catch (error) {
      console.error("Failed to parse stored exercises", error);
      return hydrateState(DEFAULT_STATE);
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addExercise = (name, groupId = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setState((prev) => {
      const normalizedGroupId = normalizeGroupId(groupId);
      const siblings = getOrderedExerciseIds(prev.exercises, normalizedGroupId);
      const newExercise = {
        id: Date.now().toString(),
        name: trimmed,
        entries: [],
        groupId: normalizedGroupId,
        order: siblings.length,
      };

      return {
        ...prev,
        exercises: [...prev.exercises, newExercise],
      };
    });
  };

  const addGroup = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setState((prev) => {
      const newGroup = {
        id: Date.now().toString(),
        name: trimmed,
        order: prev.groups.length,
      };

      return {
        ...prev,
        groups: [...prev.groups, newGroup],
      };
    });
  };

  const reorderGroups = (orderedIds) => {
    setState((prev) => {
      const lookup = new Map(prev.groups.map((group) => [group.id, group]));
      const ordered = orderedIds
        .map((id) => lookup.get(id))
        .filter(Boolean)
        .map((group, index) => ({ ...group, order: index }));

      const missing = prev.groups.filter((group) => !orderedIds.includes(group.id));
      const complete = [...ordered, ...missing.map((group, index) => ({ ...group, order: ordered.length + index }))];

      return {
        ...prev,
        groups: complete,
      };
    });
  };

  const moveExercise = (exerciseId, targetGroupId, targetIndex) => {
    setState((prev) => {
      const targetGroup = normalizeGroupId(targetGroupId);
      const exercise = prev.exercises.find((ex) => ex.id === exerciseId);
      if (!exercise) return prev;

      const sourceGroup = normalizeGroupId(exercise.groupId);
      const sourceIds = getOrderedExerciseIds(prev.exercises, sourceGroup).filter((id) => id !== exerciseId);
      const baseTargetIds = sourceGroup === targetGroup ? sourceIds : getOrderedExerciseIds(prev.exercises, targetGroup);
      const insertionIndex = clamp(targetIndex, 0, baseTargetIds.length);
      const targetIds = [...baseTargetIds];
      targetIds.splice(insertionIndex, 0, exerciseId);

      let updatedExercises = prev.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, groupId: targetGroup } : ex
      );

      if (sourceGroup !== targetGroup) {
        updatedExercises = applyExerciseOrder(updatedExercises, sourceGroup, sourceIds);
      }

      updatedExercises = applyExerciseOrder(updatedExercises, targetGroup, targetIds);

      return { ...prev, exercises: updatedExercises };
    });
  };

  const addEntry = (exerciseId, date, weight, reps, note = "") => {
    if (!date || !weight || !reps) return;

    const trimmedNote = note?.trim() ?? "";

    setState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              entries: [
                ...exercise.entries,
                {
                  date,
                  weight: Number(weight),
                  reps: Number(reps),
                  note: trimmedNote,
                },
              ],
            }
          : exercise
      ),
    }));
  };

  const deleteEntry = (exerciseId, entryToDelete) => {
    setState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const normalizeValue = (value) => (value ?? "");
        return {
          ...exercise,
          entries: exercise.entries.filter(
            (entry) =>
              !(
                entry.date === entryToDelete.date &&
                entry.weight === entryToDelete.weight &&
                entry.reps === entryToDelete.reps &&
                normalizeValue(entry.note) === normalizeValue(entryToDelete.note)
              )
          ),
        };
      }),
    }));
  };

  const deleteExercise = (exerciseId) => {
    setState((prev) => ({
      ...prev,
      exercises: ensureSequentialExerciseOrder(prev.exercises.filter((exercise) => exercise.id !== exerciseId)),
    }));
  };

  const replaceState = (nextState) => {
    setState(hydrateState(nextState));
  };

  const setExerciseViewMode = (viewMode) => {
    if (!isValidExerciseViewMode(viewMode)) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        exerciseViewMode: viewMode,
      },
    }));
  };

  return {
    exercises: state.exercises,
    groups: state.groups,
    settings: state.settings,
    addExercise,
    addGroup,
    addEntry,
    deleteEntry,
    deleteExercise,
    moveExercise,
    reorderGroups,
    replaceState,
    setExerciseViewMode,
  };
}
