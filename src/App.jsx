import { AddExerciseForm } from "./components/AddExerciseForm";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { colors } from "./theme";

function App() {
  const { exercises, addExercise, addEntry, deleteEntry} = useExercises();

  return (
    <div
      style={{
        textAlign: "center",
        marginBottom: "1rem",
        padding: "0.5rem 0",
      }}
    >
      <h1
        style={{
          fontSize: "1.75rem",
          margin: 0,
          fontWeight: 700,
          color: colors.text, // Apply your theme color
          border: `3px solid ${colors.border}`,
        }}
      >
        RepLog
      </h1>

      <div style={{ marginTop: "0.75rem" }}>
        <AddExerciseForm onAdd={addExercise} />
      </div>

      <ExerciseList exercises={exercises} onAddEntry={addEntry} onDeleteEntry={deleteEntry} />
    </div>
  );
}

export default App;
