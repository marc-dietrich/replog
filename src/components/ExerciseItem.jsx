import { useMemo, useState } from "react";

const chartWidth = 200;
const chartHeight = 60;
const padding = 8;
const DELETE_CONFIRM_MESSAGE = "Delete this exercise and all entries?";

const today = () => new Date().toISOString().slice(0, 10);

function getLastEntry(exercise) {
  if (!exercise.entries.length) return null;
  return exercise.entries[exercise.entries.length - 1];
}

export function ExerciseItem({ exercise, isOpen, onToggle, onAddEntry, onDeleteEntry, onDeleteExercise }) {
  const lastEntry = getLastEntry(exercise);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [note, setNote] = useState("");

  const sortedEntries = useMemo(
    () => [...exercise.entries].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [exercise.entries]
  );

  const recentEntries = useMemo(
    () => [...sortedEntries].reverse().slice(0, 3),
    [sortedEntries]
  );

  const sparklinePoints = useMemo(() => {
    if (sortedEntries.length === 0) return "";

    const weights = sortedEntries.map((entry) => entry.weight);
    let min = Math.min(...weights);
    let max = Math.max(...weights);

    if (min === max) {
      min -= 1;
      max += 1;
    }

    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;

    return sortedEntries
      .map((entry, index) => {
        const ratio =
          sortedEntries.length === 1 ? 0.5 : index / (sortedEntries.length - 1);
        const x = padding + innerWidth * ratio;
        const normalized = (entry.weight - min) / (max - min || 1);
        const y = padding + innerHeight * (1 - normalized);
        return `${x},${y}`;
      })
      .join(" ");
  }, [sortedEntries]);

  const resetQuickEntry = () => {
    setShowQuickEntry(false);
    setWeight("");
    setReps("");
    setNote("");
  };

  const handleAddEntry = (event) => {
    event.stopPropagation();
    if (!weight.trim() || !reps.trim()) return;

    const autoDate = today();
    onAddEntry(exercise.id, autoDate, weight, reps, note);
    resetQuickEntry();
  };

  const handleDeleteEntry = (entryToDelete, event) => {
    event.stopPropagation();
    onDeleteEntry(exercise.id, entryToDelete);
  };

  const toggleQuickEntry = (event) => {
    event.stopPropagation();
    if (showQuickEntry) {
      resetQuickEntry();
    } else {
      setShowQuickEntry(true);
    }
  };

  return (
    <article
      className="relative rounded-2xl border border-slate-200 bg-card-light p-5 shadow-sm transition hover:border-primary dark:border-slate-800 dark:bg-card-dark"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="absolute right-4 top-4">
        <button
          type="button"
          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow transition hover:border-primary ${
            showQuickEntry ? "border-primary text-primary" : ""
          }`}
          aria-label={showQuickEntry ? "Close quick entry" : "Add entry"}
          onClick={(event) => {
            event.stopPropagation();
            toggleQuickEntry(event);
          }}
        >
          <span className="material-icons-round text-sm">add</span>
        </button>
      </div>
      <div className="pr-4">
        <h3 className="font-display text-lg font-semibold">{exercise.name}</h3>
        {lastEntry && (
          <p className="mt-1 text-sm text-slate-500">
            Last: {lastEntry.weight} kg × {lastEntry.reps} • {lastEntry.date}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40" aria-hidden={sortedEntries.length === 0}>
        {sparklinePoints ? (
          <svg
            className="h-16 w-full text-primary"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="presentation"
          >
            <polyline
              points={sparklinePoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {sparklinePoints.split(" ").map((point, index) => {
              const [x, y] = point.split(",").map(Number);
              return <circle key={index} cx={x} cy={y} r={3} fill="currentColor" />;
            })}
          </svg>
        ) : (
          <p className="text-center text-sm text-slate-400">No data yet</p>
        )}
      </div>

      {showQuickEntry && (
        <div
          className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm dark:bg-slate-900/60"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="kg"
              step="0.5"
              min="0"
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="number"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              placeholder="Reps"
              min="1"
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              className="sm:col-span-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-3 text-base">
            <button
              type="button"
              className="flex-1 rounded-2xl border border-slate-200 py-2 font-semibold text-slate-600"
              onClick={(event) => {
                event.stopPropagation();
                resetQuickEntry();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 rounded-2xl bg-slate-900 py-2 font-semibold text-white"
              onClick={handleAddEntry}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"
          onClick={(event) => event.stopPropagation()}
        >
          {recentEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No entries for this exercise yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recentEntries.map((entry, index) => (
                <li key={`${entry.date}-${index}`} className="flex items-center gap-3">
                  <div className="min-w-[110px]">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.date}</p>
                    <p className="text-xs italic text-slate-500">{entry.note || "—"}</p>
                  </div>
                  <div className="flex flex-1 items-center justify-center text-slate-700">
                    <span className="font-semibold">
                      {entry.weight} kg × {entry.reps}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-red-500"
                    onClick={(event) => handleDeleteEntry(entry, event)}
                  >
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-400 hover:text-red-500"
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(DELETE_CONFIRM_MESSAGE)) {
                  onDeleteExercise?.(exercise.id);
                }
              }}
            >
              <span className="material-icons-round text-sm">delete</span>
              Delete exercise
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
