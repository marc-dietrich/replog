import { useState } from "react";
import { ExerciseItem } from "./ExerciseItem";

export function ExerciseList({ exercises, onAddEntry, onDeleteEntry, onDeleteExercise }) {
  const [openExerciseId, setOpenExerciseId] = useState(null);

  const toggleExercise = (exerciseId) => {
    setOpenExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  if (exercises.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-500">
        No exercises yet. Use the button above to add your first one.
      </p>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {exercises.map((exercise) => (
        <ExerciseItem
          key={exercise.id}
          exercise={exercise}
          isOpen={openExerciseId === exercise.id}
          onToggle={() => toggleExercise(exercise.id)}
          onAddEntry={onAddEntry}
          onDeleteEntry={onDeleteEntry}
          onDeleteExercise={onDeleteExercise}
        />
      ))}
    </div>
  );
}
