import { useState } from "react";

export function AddExerciseForm({ onAdd }) {
  const [name, setName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd(name.trim());
    setName("");
    setIsAdding(false); // close input again
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      {!isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#222",
            color: "white",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Add Exercise
        </button>
      )}

      {isAdding && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <input
            type="text"
            placeholder="Exercise name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
            }}
          />

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#222",
                color: "white",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
