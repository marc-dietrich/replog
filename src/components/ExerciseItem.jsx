import { useState } from "react";

function getLastEntry(exercise) {
  if (!exercise.entries.length) return null;
  return exercise.entries[exercise.entries.length - 1];
}

export function ExerciseItem({ exercise, isOpen, onToggle, onAddEntry }) {
  const lastEntry = getLastEntry(exercise);

  // state to show/hide weight input
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const handlePlusClick = (e) => {
    e.stopPropagation(); // prevent toggling item
    setShowWeightInput((prev) => !prev);
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!weight.trim() || !reps.trim()) return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    onAddEntry(exercise.id, today, weight, reps);

    setWeight("");
    setReps("");
    setShowWeightInput(false);
  };

  // ---- Daten für den Graphen vorbereiten ----
  const sortedEntries = [...exercise.entries].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const chartWidth = 280;
  const chartHeight = 80;
  const padding = 10;

  let points = "";

  if (sortedEntries.length > 0) {
    const weights = sortedEntries.map((e) => e.weight);
    let minW = Math.min(...weights);
    let maxW = Math.max(...weights);

    // Falls alle Gewichte gleich sind, etwas Range erzeugen
    if (minW === maxW) {
      minW = minW - 1;
      maxW = maxW + 1;
    }

    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;

    points = sortedEntries
      .map((entry, index) => {
        const t =
          sortedEntries.length === 1 ? 0.5 : index / (sortedEntries.length - 1); // 0..1
        const x = padding + innerWidth * t;

        const norm = (entry.weight - minW) / (maxW - minW || 1); // 0..1
        const y = padding + innerHeight * (1 - norm); // invert Y

        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div
      onClick={onToggle} // kompletter Eintrag toggelt open/close
      style={{
        borderRadius: "0.75rem",
        border: "1px solid #ddd",
        padding: "0.75rem",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <div>
          <div style={{ fontWeight: "bold", fontSize: "1rem" }}>
            {exercise.name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            {lastEntry
              ? `Letztes Gewicht: ${lastEntry.weight} kg × ${lastEntry.reps} am ${lastEntry.date}`
              : "Noch keine Einträge"}
          </div>
        </div>

        {/* PLUS-Button */}
        <button
          onClick={handlePlusClick}
          style={{
            fontSize: "1.5rem",
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>

      {/* Gewicht-Input unter dem Header */}
      {showWeightInput && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            flexDirection: "column", // 👉 alles untereinander
          }}
        >
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="kg"
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
            }}
          />

          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="Reps"
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
            }}
          />

          <button
            onClick={handleAdd}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              background: "#222",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✓
          </button>
        </div>
      )}

      {/* Expandable section: minimaler Graph + sortierte Liste */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: "0.75rem",
            borderTop: "1px solid #eee",
            paddingTop: "0.75rem",
          }}
        >
          {sortedEntries.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              Noch keine Einträge für diese Übung.
            </div>
          ) : (
            <>
              {/* Minimaler Line-Chart */}
              <svg
                width="100%"
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                style={{ display: "block", marginBottom: "0.5rem" }}
              >
                {/* Hintergrund */}
                <rect
                  x="0"
                  y="0"
                  width={chartWidth}
                  height={chartHeight}
                  fill="#fafafa"
                  rx="8"
                />

                {/* Linie */}
                <polyline
                  points={points}
                  fill="none"
                  stroke="#d4aa2a"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Punkte */}
                {points &&
                  points.split(" ").map((p, idx) => {
                    const [x, y] = p.split(",").map(Number);
                    return (
                      <circle key={idx} cx={x} cy={y} r="3" fill="#d4aa2a" />
                    );
                  })}
              </svg>

              {/* sortierte Liste darunter (optional, aber praktisch) */}
              {sortedEntries.slice(-5).map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.25rem",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>{entry.date}</span>
                  <span>
                    {entry.weight} kg × {entry.reps}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
