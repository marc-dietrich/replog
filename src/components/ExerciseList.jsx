import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ExerciseItem } from "./ExerciseItem";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const [activeId, setActiveId] = useState(null);
  const activeExercise = activeId ? safeExercises.find((ex) => ex.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 500, tolerance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const draggedExercise = safeExercises.find((ex) => ex.id === active.id);
      const overExercise = safeExercises.find((ex) => ex.id === over.id);
      if (!draggedExercise || !overExercise) return;

      const targetGroupId = overExercise.groupId ?? UNGROUPED_ID;
      const targetGroupExercises = groupedExercises.get(targetGroupId) ?? [];
      const overIndex = targetGroupExercises.findIndex((ex) => ex.id === over.id);

      onMoveExercise?.(
        active.id,
        targetGroupId === UNGROUPED_ID ? null : targetGroupId,
        overIndex >= 0 ? overIndex : 0
      );
    },
    [safeExercises, groupedExercises, onMoveExercise]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

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
    const exerciseIds = exercisesInGroup.map((ex) => ex.id);

    return (
      <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
        <div className={`space-y-4 ${isCollapsed ? "hidden" : ""}`}>
          {!isCollapsed &&
            exercisesInGroup.map((exercise, index) => {
              const isFirstInGroup = index === 0;
              const isLastInGroup = index === exercisesInGroup.length - 1;
              return (
                <SortableExerciseItem
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
                  isDragOverlay={false}
                />
              );
            })}
        </div>
      </SortableContext>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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

      <DragOverlay dropAnimation={null}>
        {activeExercise ? (
          <div className="pointer-events-none opacity-90">
            <ExerciseItem
              exercise={activeExercise}
              viewMode={activeViewMode}
              setsDisplayMode={setsDisplayMode}
              isOpen={false}
              onToggle={() => {}}
              onAddEntry={() => {}}
              onDeleteEntry={() => {}}
              onDeleteExercise={() => {}}
              canMoveUp={false}
              canMoveDown={false}
              isDragOverlay={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableExerciseItem({ exercise, isDragOverlay, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const nodeRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Manual scroll-through: since touch-action:none blocks native scroll,
  // we manually scroll the page for quick swipes (before the 500ms drag delay).
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    let startY = 0;
    let startScrollY = 0;
    let startTime = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let wasScrolling = false;
    let rafId = null;

    const DRAG_DELAY = 480; // slightly under the 500ms sensor delay
    const MOMENTUM_FRICTION = 0.95;
    const MOMENTUM_MIN = 0.5;

    const onTouchStart = (e) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      startY = e.touches[0].clientY;
      lastY = startY;
      startScrollY = window.scrollY;
      startTime = Date.now();
      lastTime = startTime;
      velocityY = 0;
      wasScrolling = false;
    };

    const onTouchMove = (e) => {
      if (isDraggingRef.current) return;

      const now = Date.now();
      const elapsed = now - startTime;

      // Only handle manual scroll during the pre-drag delay window
      if (elapsed < DRAG_DELAY) {
        const currentY = e.touches[0].clientY;
        const timeDelta = now - lastTime;
        if (timeDelta > 0) {
          velocityY = (lastY - currentY) / timeDelta;
        }
        lastY = currentY;
        lastTime = now;

        const totalDelta = startY - currentY;
        window.scrollTo(0, startScrollY + totalDelta);
        wasScrolling = true;
      }
    };

    const onTouchEnd = () => {
      if (isDraggingRef.current) return;

      // Apply momentum scroll for a natural feel
      if (wasScrolling && Math.abs(velocityY) > 0.3) {
        let v = velocityY * 16; // px per frame (~16ms)
        const decelerate = () => {
          v *= MOMENTUM_FRICTION;
          if (Math.abs(v) > MOMENTUM_MIN) {
            window.scrollBy(0, v);
            rafId = requestAnimationFrame(decelerate);
          }
        };
        rafId = requestAnimationFrame(decelerate);
      }
      wasScrolling = false;
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const combinedRef = useCallback(
    (node) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative",
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTouchCallout: "none",
    touchAction: "none",
  };

  return (
    <div ref={combinedRef} style={style} {...attributes} {...listeners}>
      <ExerciseItem
        exercise={exercise}
        {...props}
        isDragging={isDragging}
      />
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
