import { AddExerciseForm } from "./components/AddExerciseForm";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { colors } from "./theme";

function App() {
  const { exercises, addExercise, addEntry, deleteEntry } = useExercises();

  return (
    <div>
      <h1
        style={{
          width: "100%",
          background: "#D4AA2A",
          //padding: "1rem",
          borderBottomLeftRadius: "1.25rem",
          borderBottomRightRadius: "1.25rem",
          boxSizing: "border-box",
          textAlign: "center",
          color: colors.text
        }}
      >
        RepLog
      </h1>

      <div
        style={{
          width: "90%",
          margin: "5%"
        }}
      >
        <AddExerciseForm onAdd={addExercise} />
        <ExerciseList
          exercises={exercises}
          onAddEntry={addEntry}
          onDeleteEntry={deleteEntry}
        />
      </div>
    </div>
  );
}

export default App;
