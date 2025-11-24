import { AddExerciseForm } from "./components/AddExerciseForm";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { colors } from "./theme";


function App() {
  const { exercises, addExercise, addEntry } = useExercises();

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        width: "90%",
        margin: "0 auto",
        padding: "1rem",
        alignItems: "flex-start",
        background: colors.background,     // ← theme applied
        color: colors.text,                // ← theme applied
      }}
    >
      {/* Header Section */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: colors.card,          // ← card background
          border: `1px solid ${colors.border}`, 
          borderRadius: "0.5rem",
          padding: "0.75rem",
          marginBottom: "1rem",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            margin: 0,
            color: colors.text,             // ← ensure color consistency
          }}
        >
          RepLog
        </h1>

        {/* Force top alignment for AddExerciseForm */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <AddExerciseForm onAdd={addExercise} />
        </div>
      </div>

      {/* Exercise List */}
      <ExerciseList exercises={exercises} onAddEntry={addEntry} />
    </div>
  );
}

export default App;
