import { useMemo, useState } from "react";
import { ExerciseItem } from "./ExerciseItem";

const UNGROUPED_ID = null;

export function ExerciseList({
  exercises,
  groups,
  activeViewMode,
  setsDisplayMode,
  onAddEntry,
  onDeleteEntry,
  onDeleteExercise,
  onMoveExercise,
}) {
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const safeExercises = Array.isArray(exercises) ? exercises : [];

  const orderedGroups = useMemo(() => {
    const list = Array.isArray(groups) ? [...groups] : [];
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [groups]);

  const groupedExercises = useMemo(() => {
    const bucket = new Map();
    bucket.set(UNGROUPED_ID, []);
    orderedGroups.forEach((group) => bucket.set(group.id, []));

    safeExercises.forEach((exercise) => {
      const key = exercise.groupId ?? UNGROUPED_ID;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(exercise);
    });

    bucket.forEach((list) => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return bucket;
  }, [exercises, orderedGroups]);

  const groupOrderMaps = useMemo(() => {
    const maps = new Map();
    groupedExercises.forEach((list, groupId) => {
      const orderById = new Map();
      list.forEach((exercise, index) => orderById.set(exercise.id, index));
      maps.set(groupId, orderById);
    });
    return maps;
  }, [groupedExercises]);

  const getExerciseIds = (groupId) => (groupedExercises.get(groupId) ?? []).map((exercise) => exercise.id);
  const totalExercises = safeExercises.length;

  const toggleExercise = (exerciseId) => {
    setOpenExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  const toggleGroup = (groupId) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (totalExercises === 0 && orderedGroups.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-500">
        No exercises yet. Use the button above to add your first one.
      </p>
    );
  }

  const moveExercise = (exerciseId, direction) => {
    const exercise = safeExercises.find((item) => item.id === exerciseId);
    if (!exercise) return;

    const currentGroupId = exercise.groupId ?? UNGROUPED_ID;
    const orderMap = groupOrderMaps.get(currentGroupId);
    if (!orderMap) return;

    const currentIndex = orderMap.get(exerciseId);
    if (typeof currentIndex !== "number") return;

    const ids = getExerciseIds(currentGroupId);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0) {
      // move to previous group if exists
      const groupIds = [UNGROUPED_ID, ...orderedGroups.map((g) => g.id)];
      const currentGroupIndex = groupIds.indexOf(currentGroupId);
      if (currentGroupIndex <= 0) return;
      const previousGroupId = groupIds[currentGroupIndex - 1];
      const previousIds = getExerciseIds(previousGroupId);
      onMoveExercise?.(
        exerciseId,
        previousGroupId === UNGROUPED_ID ? null : previousGroupId,
        Math.max(previousIds.length, 0)
      );
      return;
    }

    if (targetIndex > ids.length - 1) {
      const groupIds = [UNGROUPED_ID, ...orderedGroups.map((g) => g.id)];
      const currentGroupIndex = groupIds.indexOf(currentGroupId);
      if (currentGroupIndex === -1 || currentGroupIndex >= groupIds.length - 1) return;
      const nextGroupId = groupIds[currentGroupIndex + 1];
      onMoveExercise?.(
        exerciseId,
        nextGroupId === UNGROUPED_ID ? null : nextGroupId,
        0
      );
      return;
    }

    onMoveExercise?.(
      exerciseId,
      currentGroupId === UNGROUPED_ID ? null : currentGroupId,
      targetIndex
    );
  };

  const renderExerciseList = (groupId) => {
    const exercisesInGroup = groupedExercises.get(groupId) ?? [];
    const isCollapsed = collapsedGroupIds.has(groupId);

    return (
      <div className={`space-y-4 ${isCollapsed ? "hidden" : ""}`}>
        {!isCollapsed &&
          exercisesInGroup.map((exercise, index) => {
            const isFirstInGroup = index === 0;
            const isLastInGroup = index === exercisesInGroup.length - 1;
            return (
              <ExerciseItem
                key={exercise.id}
                exercise={exercise}
                viewMode={activeViewMode}
                setsDisplayMode={setsDisplayMode}
                isOpen={openExerciseId === exercise.id}
                onToggle={() => toggleExercise(exercise.id)}
                onAddEntry={onAddEntry}
                onDeleteEntry={onDeleteEntry}
                onDeleteExercise={onDeleteExercise}
                canMoveUp={!isFirstInGroup || orderedGroups.length > 0}
                canMoveDown={!isLastInGroup || orderedGroups.length > 0}
                onMoveUp={() => moveExercise(exercise.id, -1)}
                onMoveDown={() => moveExercise(exercise.id, 1)}
              />
            );
          })}
      </div>
    );
  };

  return (
    <div className="space-y-6" aria-live="polite">
      {renderExerciseList(UNGROUPED_ID)}

      {orderedGroups.length > 0 && (
        <div className="space-y-6">
          {orderedGroups.map((group) => {
            const isCollapsed = collapsedGroupIds.has(group.id);
            return (
              <div key={group.id} className="space-y-3">
                <GroupLabel
                  group={group}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(group.id)}
                />
                {renderExerciseList(group.id)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ group, isCollapsed, onToggle }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex-1 border-t border-dashed border-slate-300"></div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">{group.name}</span>
      </div>
      <button
        type="button"
        className="ml-auto inline-flex items-center justify-center rounded-full border border-transparent p-1 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
        aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
        onClick={onToggle}
      >
        <span
          className={`material-icons-round text-base transition-transform ${
            isCollapsed ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>
      <div className="flex-1 border-t border-dashed border-slate-300"></div>
    </div>
  );
}
