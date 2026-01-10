import { AddExerciseForm } from "./components/AddExerciseForm";
import { ExerciseList } from "./components/ExerciseList";
import { useExercises } from "./hooks/useExercises";
import { colors } from "./theme";
import { useRef } from "react";
import { useState } from "react";

function App() {
  const { exercises, addExercise, addEntry, deleteEntry, setExercises } =
    useExercises();

  const fileInputRef = useRef(null);

  const handleExport = () => {
    const json = JSON.stringify(exercises, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "replog-data.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        if (!Array.isArray(imported)) {
          alert("Invalid JSON format.");
          return;
        }

        // completely overwrite saved data
        setExercises(imported);

        // store into localStorage automatically
        // because your hook already does it
        alert("Data imported successfully!");
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div>
      <h1
        style={{
          width: "98%",
          margin: "1%",
          background: "#D4AA2A",
          borderRadius: "1.25rem",
          boxSizing: "border-box",
          textAlign: "center",
          color: colors.text,
          //padding: "0.5rem",
        }}
      >
        RepLog v1.0.2
      </h1>

      <div
        style={{
          width: "90%",
          margin: "5%",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div style={{ flex: "1 1 97%" }}>
            <AddExerciseForm onAdd={addExercise} />
          </div>

          <div style={{ flex: "1 1 3%" }}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              style={{
                borderRadius: "0.5rem",
                border: "none",
                background: "#222",
                color: "white",
                cursor: "pointer",
                fontSize: "1.4rem",
                alignItems: "center",
                justifyContent: "right",
                width: "100%"
              }}
            >
              ⋮
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div
            style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "0.75rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                textAlign: "center",
                color: "#1F2937",
              }}
            >
              Backup & Restore
            </h2>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem"}}>
              <button
                onClick={handleExport}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  background: "#222",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Export JSON
              </button>

              <button
                onClick={() => fileInputRef.current.click()}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  background: "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Import JSON
              </button>
            </div>

            <input
              type="file"
              accept="application/json"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImport}
            />
          </div>
        )}

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
