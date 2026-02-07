import { useMemo, useState } from "react";
import { ExerciseItem } from "./ExerciseItem";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const UNGROUPED_ID = null;

const toContainerId = (groupId) => (groupId == null ? "ungrouped" : `group-${groupId}`);

export function ExerciseList({
  exercises,
  groups,
  onAddEntry,
  onDeleteEntry,
  onDeleteExercise,
  onMoveExercise,
  onReorderGroups,
}) {
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedGroups = useMemo(() => {
    const list = Array.isArray(groups) ? [...groups] : [];
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [groups]);

  const groupedExercises = useMemo(() => {
    const bucket = new Map();
    bucket.set(UNGROUPED_ID, []);
    orderedGroups.forEach((group) => bucket.set(group.id, []));

    (exercises ?? []).forEach((exercise) => {
      const key = exercise.groupId ?? UNGROUPED_ID;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(exercise);
    });

    bucket.forEach((list) => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return bucket;
  }, [exercises, orderedGroups]);

  const getExerciseIds = (groupId) => (groupedExercises.get(groupId) ?? []).map((exercise) => exercise.id);
  const totalExercises = exercises?.length ?? 0;

  const toggleExercise = (exerciseId) => {
    setOpenExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  if (totalExercises === 0 && orderedGroups.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-500">
        No exercises yet. Use the button above to add your first one.
      </p>
    );
  }

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "group" && overType === "group") {
      const ids = orderedGroups.map((group) => group.id);
      const activeIndex = ids.indexOf(active.id);
      const overIndex = ids.indexOf(over.id);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const reordered = arrayMove(ids, activeIndex, overIndex);
        onReorderGroups?.(reordered);
      }
      return;
    }

    if (activeType === "exercise") {
      const originGroupId = active.data.current?.groupId ?? UNGROUPED_ID;
      const originIds = getExerciseIds(originGroupId).filter((id) => id !== active.id);

      let targetGroupId = originGroupId;
      let targetIndex = originIds.indexOf(active.id);

      if (overType === "group") {
        return;
      } else if (overType === "exercise") {
        targetGroupId = over.data.current?.groupId ?? UNGROUPED_ID;
        const siblings = getExerciseIds(targetGroupId);
        const overIndex = siblings.indexOf(over.id);
        targetIndex = overIndex === -1 ? siblings.length : overIndex;
      } else if (overType === "exercise-container") {
        targetGroupId = over.data.current?.groupId ?? UNGROUPED_ID;
        targetIndex = getExerciseIds(targetGroupId).length;
      } else {
        return;
      }

      onMoveExercise?.(
        active.id,
        targetGroupId === UNGROUPED_ID ? null : targetGroupId,
        targetIndex < 0 ? 0 : targetIndex
      );
    }
  };

  const renderExerciseList = (groupId) => {
    const exercisesInGroup = groupedExercises.get(groupId) ?? [];
    const exerciseIds = getExerciseIds(groupId);

    return (
      <ExerciseContainer droppableId={toContainerId(groupId)} groupId={groupId} itemCount={exerciseIds.length}>
        <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
          {exercisesInGroup.map((exercise) => (
            <SortableExerciseCard
              key={exercise.id}
              exercise={exercise}
              groupId={groupId}
              isOpen={openExerciseId === exercise.id}
              onToggle={() => toggleExercise(exercise.id)}
              onAddEntry={onAddEntry}
              onDeleteEntry={onDeleteEntry}
              onDeleteExercise={onDeleteExercise}
            />
          ))}
        </SortableContext>
      </ExerciseContainer>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="space-y-6" aria-live="polite">
        {renderExerciseList(UNGROUPED_ID)}

        {orderedGroups.length > 0 && (
          <SortableContext items={orderedGroups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
            {orderedGroups.map((group) => (
              <div key={group.id} className="space-y-3">
                <SortableGroupLabel group={group} />
                {renderExerciseList(group.id)}
              </div>
            ))}
          </SortableContext>
        )}
      </div>
    </DndContext>
  );
}

function ExerciseContainer({ droppableId, groupId, itemCount, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "exercise-container", groupId, length: itemCount },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[12px] space-y-4 rounded-2xl border border-transparent p-1 transition ${
        isOver ? "border-slate-300 bg-slate-50" : ""
      }`}
    >
      {children}
    </div>
  );
}

function SortableExerciseCard({ exercise, groupId, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
    data: { type: "exercise", groupId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : undefined}>
      <ExerciseItem
        exercise={exercise}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        {...props}
      />
    </div>
  );
}

function SortableGroupLabel({ group }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: "group", groupId: group.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-75" : undefined}>
      <div
        className="flex items-center gap-3"
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
          }
        }}
      >
        <div className="flex-1 border-t border-dashed border-slate-300"></div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">{group.name}</span>
        <div className="flex-1 border-t border-dashed border-slate-300"></div>
      </div>
    </div>
  );
}
