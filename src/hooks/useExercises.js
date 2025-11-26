// src/hooks/useExercises.js
import { useEffect, useState } from "react";

const STORAGE_KEY = "gym-tracker-exercises";

export function useExercises() {
  // Load ONCE from localStorage when the hook is created
  const [exercises, setExercises] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log("INIT from localStorage: none");
      return [];
    }
    try {
      const parsed = JSON.parse(stored);
      console.log("INIT from localStorage:", parsed);
      return parsed;
    } catch (e) {
      console.error("Error parsing localStorage:", e);
      return [];
    }
  });

  // Save whenever exercises change
  useEffect(() => {
    console.log("SAVE to localStorage:", exercises);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
  }, [exercises]);

  const addExercise = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newExercise = {
      id: Date.now().toString(),
      name: trimmed,
      entries: [],
    };

    setExercises((prev) => [...prev, newExercise]);
  };

  const addEntry = (exerciseId, date, weight, reps) => {
  if (!date || !weight || !reps) return;

  setExercises((prev) =>
    prev.map((ex) =>
      ex.id === exerciseId
        ? {
            ...ex,
            entries: [
              ...ex.entries,
              {
                date,
                weight: Number(weight),
                reps: Number(reps),
              },
            ],
          }
        : ex
    )
  );
};

const deleteEntry = (exerciseId, entryToDelete) => {
  setExercises((prev) =>
    prev.map((ex) => {
      if (ex.id !== exerciseId) return ex;

      return {
        ...ex,
        entries: ex.entries.filter(
          (entry) =>
            !(
              entry.date === entryToDelete.date &&
              entry.weight === entryToDelete.weight &&
              entry.reps === entryToDelete.reps
            )
        ),
      };
    })
  );
};

return { exercises, addExercise, addEntry, deleteEntry, setExercises };

}
