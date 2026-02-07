import { useMemo, useState } from "react";
import { ExerciseTrendChart } from "./ExerciseTrendChart";

const DELETE_CONFIRM_MESSAGE = "Delete this exercise and all entries?";

const today = () => new Date().toISOString().slice(0, 10);

const SPARKLINE_WIDTH = 48;
const SPARKLINE_HEIGHT = 18;
const FALLBACK_SPARKLINE_PATH = "M2 14 L10 11 L18 13 L26 8 L34 12 L42 7";

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

  const previewEntries = useMemo(() => sortedEntries.slice(-6), [sortedEntries]);

  const sparklinePath = useMemo(() => {
    if (previewEntries.length === 0) return null;

    const values = previewEntries.map((entry) => {
      const numericWeight = parseFloat(entry.weight);
      return Number.isFinite(numericWeight) ? numericWeight : 0;
    });

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const graphWidth = SPARKLINE_WIDTH - 4;
    const graphHeight = SPARKLINE_HEIGHT - 4;
    const denominator = values.length > 1 ? values.length - 1 : 1;

    const points = values.map((value, index) => {
      const x = 2 + (index / denominator) * graphWidth;
      const normalized = (value - min) / range;
      const y = SPARKLINE_HEIGHT - 2 - normalized * graphHeight;
      return { x, y };
    });

    if (values.length === 1) {
      points.push({ x: SPARKLINE_WIDTH - 2, y: points[0].y });
    }

    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }, [previewEntries]);

  const sparklineDisplayPath = sparklinePath ?? FALLBACK_SPARKLINE_PATH;

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

  const stopPropagation = (event) => event.stopPropagation();

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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-16 items-center justify-center rounded-full bg-amber-50/80 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/30">
            <svg
              viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
              className="h-4 w-12 text-amber-500 dark:text-amber-400"
              aria-hidden="true"
            >
              <path
                d={sparklineDisplayPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-90"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold">{exercise.name}</h3>
            {lastEntry ? (
              <p className="mt-1 text-sm text-slate-500">
                Last: {lastEntry.weight} kg × {lastEntry.reps} • {lastEntry.date}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No entries yet.</p>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="mt-4"
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          onPointerDown={stopPropagation}
          onKeyDown={stopPropagation}
        >
          <ExerciseTrendChart entries={sortedEntries} />
        </div>
      )}

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
