import { useState } from "react";
import { ExerciseItem } from "./ExerciseItem";

export function ExerciseList({ exercises, onAddEntry, onDeleteEntry}) {
  const [openExerciseId, setOpenExerciseId] = useState(null);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      {exercises.length === 0 && (
        <p style={{ color: "#666" }}>
          Noch keine Übungen. Leg oben eine neue an.
        </p>
      )}

      {exercises.map((exercise) => (
        <ExerciseItem
          key={exercise.id}
          exercise={exercise}
          isOpen={openExerciseId === exercise.id}
          onToggle={() =>
            setOpenExerciseId(
              openExerciseId === exercise.id ? null : exercise.id
            )
          }
          onAddEntry={onAddEntry}
          onDeleteEntry={onDeleteEntry}
        />
      ))}
    </div>
  );
}
