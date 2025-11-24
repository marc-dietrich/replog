import { useState } from "react";
import { colors } from "../theme";


export function AddEntryForm({ onAdd }) {
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !weight) return;
    onAdd(date, weight);
    setWeight("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        marginTop: "0.75rem",
        color: colors.text,
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            flex: 1,
            padding: "0.4rem",
            borderRadius: "0.5rem",
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: colors.text,
          }}
        />

        <input
          type="number"
          step="0.5"
          min="0"
          placeholder="Gewicht (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          style={{
            width: "8rem",
            padding: "0.4rem",
            borderRadius: "0.5rem",
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: colors.text,
          }}
        />
      </div>

      <button
        type="submit"
        style={{
          alignSelf: "flex-start",
          padding: "0.4rem 0.75rem",
          borderRadius: "0.5rem",
          border: "none",
          background: colors.primary,  // ← theme primary
          color: "white",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Eintrag hinzufügen
      </button>
    </form>
  );
}
