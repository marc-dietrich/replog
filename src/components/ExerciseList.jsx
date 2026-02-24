import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { ExerciseItem } from "./ExerciseItem";
import {
  DndContext,
  closestCenter,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const UNGROUPED_ID = null;

// --- Multi-type DnD helpers ---
const GROUP_DRAG_PREFIX = "group::";
const CONTAINER_PREFIX = "container::";
const isGroupDragId = (id) => typeof id === "string" && id.startsWith(GROUP_DRAG_PREFIX);
const toGroupDragId = (groupId) => `${GROUP_DRAG_PREFIX}${groupId}`;
const fromGroupDragId = (id) => id.slice(GROUP_DRAG_PREFIX.length);
const toContainerId = (groupId) => `${CONTAINER_PREFIX}${groupId ?? "ungrouped"}`;

// When dragging a group  → only collide with other group sortables.
// When dragging an exercise → prefer exercise targets, fall back to group containers.
function multiContainerCollision(args) {
  const activeData = args.active.data.current;

  if (activeData?.type === "group") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === "group"
      ),
    });
  }

  // Exercise drag: check for actual rect overlap with exercise items first
  const exerciseContainers = args.droppableContainers.filter(
    (c) => c.data.current?.type === "exercise"
  );
  const exerciseOverlaps = rectIntersection({ ...args, droppableContainers: exerciseContainers });
  if (exerciseOverlaps.length > 0) {
    // Among overlapping exercises pick the one with the closest center
    return closestCenter({ ...args, droppableContainers: exerciseContainers });
  }

  // No exercise overlap – fall back to group container zones (enables empty-group drops)
  const groupContainers = args.droppableContainers.filter(
    (c) => c.data.current?.type === "group-container"
  );
  return closestCenter({ ...args, droppableContainers: groupContainers });
}

export function ExerciseList({
  exercises,
  groups,
  activeViewMode,
  setsDisplayMode,
  onAddEntry,
  onDeleteEntry,
  onDeleteExercise,
  onDeleteGroup,
  onMoveExercise,
  onReorderGroups,
}) {
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());
  const safeExercises = useMemo(
    () => (Array.isArray(exercises) ? exercises : []),
    [exercises]
  );

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
  }, [safeExercises, orderedGroups]);

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

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroupIds((prev) => {
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
  const [activeType, setActiveType] = useState(null); // "exercise" | "group"
  const [dragOverGroupId, setDragOverGroupId] = useState(undefined);

  const activeExercise =
    activeType === "exercise" && activeId ? safeExercises.find((ex) => ex.id === activeId) : null;
  const activeGroup =
    activeType === "group" && activeId ? orderedGroups.find((g) => g.id === activeId) : null;

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
    const id = event.active.id;
    if (isGroupDragId(id)) {
      setActiveType("group");
      setActiveId(fromGroupDragId(id));
    } else {
      setActiveType("exercise");
      setActiveId(id);
    }
  }, []);

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || !active) {
        setDragOverGroupId(undefined);
        return;
      }
      const activeData = active.data.current;
      if (activeData?.type !== "exercise") {
        setDragOverGroupId(undefined);
        return;
      }
      const overData = over.data.current;
      if (overData?.type === "exercise") {
        setDragOverGroupId(overData.groupId ?? UNGROUPED_ID);
      } else if (overData?.type === "group-container") {
        setDragOverGroupId(overData.groupId ?? UNGROUPED_ID);
      } else {
        setDragOverGroupId(undefined);
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event) => {
      setActiveId(null);
      setActiveType(null);
      setDragOverGroupId(undefined);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeData = active.data.current;

      // ---- Group reorder ----
      if (activeData?.type === "group") {
        const overData = over.data.current;
        if (overData?.type !== "group") return;
        const groupIds = orderedGroups.map((g) => g.id);
        const oldIndex = groupIds.indexOf(activeData.groupId);
        const newIndex = groupIds.indexOf(overData.groupId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = [...groupIds];
        reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, activeData.groupId);
        onReorderGroups?.(reordered);
        return;
      }

      // ---- Exercise move ----
      const overData = over.data.current;
      if (overData?.type === "exercise") {
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
      } else if (overData?.type === "group-container") {
        // Drop on empty group container
        const targetGroupId = overData.groupId;
        const normalizedTarget = targetGroupId ?? UNGROUPED_ID;
        const targetGroupExercises = groupedExercises.get(normalizedTarget) ?? [];
        onMoveExercise?.(
          active.id,
          normalizedTarget === UNGROUPED_ID ? null : normalizedTarget,
          targetGroupExercises.length
        );
      }
    },
    [safeExercises, groupedExercises, orderedGroups, onMoveExercise, onReorderGroups]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveType(null);
    setDragOverGroupId(undefined);
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

  const renderExerciseList = (groupId, isGroupExpanded = true, options = {}) => {
    const { compact = false, scaffold = false, hasContinuationAfterList = false } = options;
    const exercisesInGroup = groupedExercises.get(groupId) ?? [];
    const visibleExercises = isGroupExpanded ? exercisesInGroup : exercisesInGroup.slice(0, 2);
    const exerciseIds = visibleExercises.map((ex) => ex.id);

    return (
      <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
        <div className={compact ? "flex flex-col gap-2.5" : "space-y-4"}>
          {visibleExercises.map((exercise, index) => {
            const isFirstInGroup = index === 0;
            const isLastInGroup = index === visibleExercises.length - 1;
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
                compact={compact}
                scaffold={scaffold}
                scaffoldHasTop={scaffold}
                scaffoldHasBottom={
                  scaffold && (index < visibleExercises.length - 1 || hasContinuationAfterList)
                }
                scaffoldIsFirstItem={index === 0}
              />
            );
          })}
        </div>
      </SortableContext>
    );
  };

  const groupDragIds = orderedGroups.map((g) => toGroupDragId(g.id));
  const activeExerciseGroupId = activeExercise ? (activeExercise.groupId ?? UNGROUPED_ID) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={multiContainerCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6" aria-live="polite">
        {/* Ungrouped exercises – also a droppable zone */}
        <DroppableGroupZone
          groupId={UNGROUPED_ID}
          isEmpty={(groupedExercises.get(UNGROUPED_ID) ?? []).length === 0}
          isHighlighted={activeType === "exercise" && dragOverGroupId === UNGROUPED_ID && activeExerciseGroupId !== UNGROUPED_ID}
          activeType={activeType}
        >
          {renderExerciseList(UNGROUPED_ID)}
        </DroppableGroupZone>

        {orderedGroups.length > 0 && (
          <SortableContext items={groupDragIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {orderedGroups.map((group) => {
                const exercisesInGroup = groupedExercises.get(group.id) ?? [];
                const hasHiddenExercises = exercisesInGroup.length > 2;
                const isExpanded = expandedGroupIds.has(group.id);
                const isDropTarget =
                  activeType === "exercise" && dragOverGroupId === group.id && activeExerciseGroupId !== group.id;

                return (
                  <SortableGroupWrapper key={group.id} group={group} isDragOverTarget={isDropTarget}>
                    {(dragHandleProps) => (
                      <div className="space-y-0">
                        <GroupLabel
                          group={group}
                          exerciseCount={exercisesInGroup.length}
                          dragHandleProps={dragHandleProps}
                          onDelete={exercisesInGroup.length === 0 ? () => onDeleteGroup?.(group.id) : undefined}
                        />
                        <DroppableGroupZone
                          groupId={group.id}
                          isEmpty={exercisesInGroup.length === 0}
                          isHighlighted={isDropTarget}
                          activeType={activeType}
                        >
                          <div>
                            {renderExerciseList(group.id, !hasHiddenExercises || isExpanded, {
                              compact: true,
                              scaffold: true,
                              hasContinuationAfterList: hasHiddenExercises,
                            })}
                          </div>
                        </DroppableGroupZone>
                        {hasHiddenExercises && (
                          <div className="relative pl-8">
                            <span
                              className="pointer-events-none absolute left-[23px] -top-2.5 bottom-1/2 w-px bg-slate-300/90 dark:bg-slate-700/90"
                              aria-hidden="true"
                            ></span>
                            <span
                              className="pointer-events-none absolute left-[23px] top-1/2 h-px w-[9px] -translate-y-1/2 bg-slate-300/90 dark:bg-slate-700/90"
                              aria-hidden="true"
                            ></span>
                            <button
                              type="button"
                              className="mt-1 flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                              onClick={() => toggleGroupExpansion(group.id)}
                            >
                              {isExpanded ? "Show less" : `Show ${exercisesInGroup.length - 2} more`}
                              <span
                                className={`material-icons-round text-sm transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                aria-hidden="true"
                              >
                                expand_more
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </SortableGroupWrapper>
                );
              })}
            </div>
          </SortableContext>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeType === "exercise" && activeExercise ? (
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
        ) : activeType === "group" && activeGroup ? (
          <div className="pointer-events-none rounded-3xl border border-primary/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-slate-900/95">
            <GroupLabel
              group={activeGroup}
              exerciseCount={(groupedExercises.get(activeGroup.id) ?? []).length}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableExerciseItem({
  exercise,
  compact = false,
  scaffold = false,
  scaffoldHasTop = false,
  scaffoldHasBottom = false,
  scaffoldIsFirstItem = false,
  ...props
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: exercise.id,
    data: { type: "exercise", groupId: exercise.groupId ?? UNGROUPED_ID },
  });

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
    <div ref={combinedRef} style={style} {...attributes} {...listeners} className={scaffold ? "relative pl-8" : ""}>
      {scaffold && (
        <>
          {scaffoldHasTop && (
            <span
              className={`pointer-events-none absolute left-[23px] bottom-1/2 w-px bg-slate-300/90 dark:bg-slate-700/90 ${
                scaffoldIsFirstItem ? "-top-8" : "-top-2.5"
              }`}
              aria-hidden="true"
            ></span>
          )}
          {scaffoldHasBottom && (
            <span
              className="pointer-events-none absolute left-[23px] top-1/2 -bottom-2.5 w-px bg-slate-300/90 dark:bg-slate-700/90"
              aria-hidden="true"
            ></span>
          )}
          <span
            className="pointer-events-none absolute left-[23px] top-1/2 h-px w-[9px] -translate-y-1/2 bg-slate-300/90 dark:bg-slate-700/90"
            aria-hidden="true"
          ></span>
        </>
      )}
      <ExerciseItem
        exercise={exercise}
        {...props}
        compact={compact}
        isDragging={isDragging}
      />
    </div>
  );
}

function GroupLabel({ group, exerciseCount, dragHandleProps, onDelete }) {
  const dragAreaRef = useRef(null);

  const handleDelete = (event) => {
    event.stopPropagation();
    event.preventDefault();
    const message =
      exerciseCount === 0
        ? `Delete the group "${group.name}"?`
        : `Delete the group "${group.name}"? The remaining exercise will be moved to ungrouped.`;
    if (window.confirm(message)) {
      onDelete?.();
    }
  };

  // Manual scroll-through for the drag area (same pattern as SortableExerciseItem)
  useEffect(() => {
    const node = dragAreaRef.current;
    if (!node || !dragHandleProps) return;

    let startY = 0;
    let startScrollY = 0;
    let startTime = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let wasScrolling = false;
    let rafId = null;

    const DRAG_DELAY = 480;
    const MOMENTUM_FRICTION = 0.95;
    const MOMENTUM_MIN = 0.5;

    const onTouchStart = (e) => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      startY = e.touches[0].clientY;
      lastY = startY;
      startScrollY = window.scrollY;
      startTime = Date.now();
      lastTime = startTime;
      velocityY = 0;
      wasScrolling = false;
    };

    const onTouchMove = (e) => {
      const now = Date.now();
      if (now - startTime < DRAG_DELAY) {
        const currentY = e.touches[0].clientY;
        const timeDelta = now - lastTime;
        if (timeDelta > 0) velocityY = (lastY - currentY) / timeDelta;
        lastY = currentY;
        lastTime = now;
        window.scrollTo(0, startScrollY + (startY - currentY));
        wasScrolling = true;
      }
    };

    const onTouchEnd = () => {
      if (wasScrolling && Math.abs(velocityY) > 0.3) {
        let v = velocityY * 16;
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
  }, [dragHandleProps]);

  return (
    <div className="flex items-center gap-3 px-1">
      <div
        ref={dragAreaRef}
        className={`flex min-w-0 flex-1 items-center gap-3${
          dragHandleProps ? " cursor-grab active:cursor-grabbing" : ""
        }`}
        style={
          dragHandleProps
            ? {
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "none",
              }
            : undefined
        }
        {...(dragHandleProps ?? {})}
      >
        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
          <span className="material-icons-round text-[18px]">fitness_center</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.6rem] font-semibold leading-none text-slate-700 dark:text-slate-100">{group.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-300">
            <span className="inline-flex h-1.5 w-3 rounded-full bg-primary/70"></span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary/60"></span>
            <span>
              {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
            </span>
            {dragHandleProps && (
              <span className="ml-1 inline-flex items-center text-slate-300 dark:text-slate-600">
                <span className="material-icons-round text-[12px]">drag_indicator</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-400 dark:text-slate-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          aria-label={`Delete group ${group.name}`}
          onClick={handleDelete}
        >
          <span className="material-icons-round text-[22px]">delete_outline</span>
        </button>
      )}
    </div>
  );
}

function SortableGroupWrapper({ group, children, isDragOverTarget }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: toGroupDragId(group.id),
    data: { type: "group", groupId: group.id },
  });

  const style = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
    ),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-3xl transition-shadow duration-200 ${
        isDragOverTarget
          ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark"
          : ""
      }`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function DroppableGroupZone({ groupId, children, isEmpty, isHighlighted, activeType }) {
  const { setNodeRef } = useDroppable({
    id: toContainerId(groupId),
    data: { type: "group-container", groupId },
  });

  return (
    <div
      ref={setNodeRef}
      className="relative rounded-2xl"
    >
      {children}
      {isEmpty && activeType === "exercise" && (
        <div
          className={`mt-1 flex items-center justify-center rounded-2xl border-2 border-dashed py-6 text-xs font-medium transition-colors duration-200 ${
            isHighlighted
              ? "border-primary/50 bg-primary/10 text-primary/70"
              : "border-slate-200/60 bg-transparent text-slate-300 dark:border-slate-700/60 dark:text-slate-600"
          }`}
        >
          <span className="material-icons-round mr-1.5 text-sm">add_circle_outline</span>
          Drop exercise here
        </div>
      )}
    </div>
  );
}
