import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_VIEW_MODES, ExerciseTrendChart, SETS_DISPLAY_MODES } from "./ExerciseTrendChart";
import { buildWorkoutTimeline } from "../utils/workoutMetrics";

const DELETE_CONFIRM_MESSAGE = "Delete this exercise and all entries?";

const today = () => new Date().toISOString().slice(0, 10);

const SPARKLINE_WIDTH = 48;
const SPARKLINE_HEIGHT = 18;
const FALLBACK_SPARKLINE_PATH = "M2 14 L10 11 L18 13 L26 8 L34 12 L42 7";
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const MAX_RECENT_WORKOUTS = 3;

export function ExerciseItem({
  exercise,
  viewMode = EXERCISE_VIEW_MODES.TOP_SET,
  setsDisplayMode = SETS_DISPLAY_MODES.CONTINUOUS,
  isOpen,
  onToggle,
  onAddEntry,
  onDeleteEntry,
  onDeleteExercise,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  isDragging = false,
  isDragOverlay = false,
}) {
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [note, setNote] = useState("");
  const [isReordering, setIsReordering] = useState(false);
  const [expandedWorkouts, setExpandedWorkouts] = useState(() => new Set());
  const cardRef = useRef(null);

  const viewModeLabel =
    viewMode === EXERCISE_VIEW_MODES.VOLUME
      ? "Volume"
      : viewMode === EXERCISE_VIEW_MODES.SETS
        ? "Sets"
        : "Top-Set";

  const sortedEntries = useMemo(
    () => [...exercise.entries].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [exercise.entries]
  );

  const lastEntry = sortedEntries.length ? sortedEntries[sortedEntries.length - 1] : null;
  const previewEntries = useMemo(() => sortedEntries.slice(-6), [sortedEntries]);

  const workoutTimeline = useMemo(() => {
    if (!sortedEntries.length) return [];
    const timeline = buildWorkoutTimeline(sortedEntries);
    return timeline.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sortedEntries]);

  const visibleWorkouts = useMemo(
    () => workoutTimeline.slice(0, MAX_RECENT_WORKOUTS),
    [workoutTimeline]
  );

  const recentEntries = useMemo(
    () => [...sortedEntries].reverse().slice(0, MAX_RECENT_WORKOUTS),
    [sortedEntries]
  );

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

  const centerCard = useCallback(() => {
    if (typeof window === "undefined" || !cardRef.current) return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const behavior = prefersReducedMotion ? "auto" : "smooth";
    requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.height;
      const availableHeight = Math.max(viewportHeight - headerHeight, 1);
      const currentScroll = window.scrollY || window.pageYOffset || 0;
      const elementTop = rect.top + currentScroll;
      const desiredScroll = elementTop - headerHeight - Math.max((availableHeight - rect.height) / 2, 0);
      window.scrollTo({ top: Math.max(desiredScroll, 0), behavior, left: 0 });
    });
  }, []);

  const resetQuickEntry = () => {
    setShowQuickEntry(false);
    setWeight("");
    setReps("");
    setNote("");
    centerCard();
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

  const toggleWorkoutDetails = (date) => {
    setExpandedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const formatWeight = (value) => `${NUMBER_FORMATTER.format(value)} kg`;
  const formatVolume = (value) => `${NUMBER_FORMATTER.format(value)} kg`;

  const getWorkoutSummaryText = (workout) => {
    if (viewMode === EXERCISE_VIEW_MODES.VOLUME) {
      return `Volume · ${formatVolume(workout.volume)}`;
    }
    if (!workout.bestSet) {
      return "No sets yet";
    }
    return `Top set · ${formatWeight(workout.bestSet.weight)} × ${workout.bestSet.reps}`;
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

  const isInteractiveElement = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const tagName = node.tagName;
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName) || node.isContentEditable;
  };

  useEffect(() => {
    if (!isReordering) return;
    const timer = setTimeout(() => setIsReordering(false), 220);
    return () => clearTimeout(timer);
  }, [isReordering]);

  const triggerReorderFeedback = () => {
    setIsReordering(true);
  };

  const handleMove = (direction, event) => {
    event.stopPropagation();
    event.preventDefault();
    if (direction === "up" && !canMoveUp) return;
    if (direction === "down" && !canMoveDown) return;

    triggerReorderFeedback();
    if (direction === "up") {
      onMoveUp?.();
    } else {
      onMoveDown?.();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    centerCard();
  }, [centerCard, isOpen]);

  return (
    <article
      ref={cardRef}
      className={`relative rounded-2xl border border-slate-200 bg-card-light p-5 shadow-sm transition duration-150 ease-out will-change-transform transform dark:border-slate-800 dark:bg-card-dark ${
        isDragging ? "ring-2 ring-primary/40 shadow-lg" : isDragOverlay ? "ring-2 ring-primary/30 shadow-xl scale-[1.02]" : isReordering ? "scale-[1.01] ring-2 ring-primary/30 shadow-xl" : "hover:border-primary"
      }`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('[data-no-toggle="true"]')) {
          return;
        }
        onToggle();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (isInteractiveElement(event.target)) {
          return;
        }
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
          data-dndkit-disable-dnd="true"
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
            <h3 className={`font-display font-semibold ${isOpen ? "text-xl" : "text-lg"}`}>
              {exercise.name}
            </h3>
            {!isOpen && (
              <p className="mt-1 text-sm text-slate-500">
                {lastEntry ? `Last: ${lastEntry.weight} kg × ${lastEntry.reps} • ${lastEntry.date}` : "No entries yet."}
              </p>
            )}
            {isOpen && (
              <div className="mt-1">
                <p className="inline-flex items-center gap-2 rounded-full bg-slate-100/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-inner dark:bg-slate-800/60 dark:text-slate-200">
                  <span className="uppercase tracking-[0.2em] text-slate-400">View</span>
                  <span>{viewModeLabel}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="mt-4"
          data-no-toggle="true"
        >
          <ExerciseTrendChart
            key={`${viewMode}-${setsDisplayMode}`}
            entries={sortedEntries}
            viewMode={viewMode}
            setsDisplayMode={setsDisplayMode}
          />
        </div>
      )}

      {showQuickEntry && (
        <div
          className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm dark:bg-slate-900/60"
          data-dndkit-disable-dnd="true"
          data-no-toggle="true"
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
          data-dndkit-disable-dnd="true"
          data-no-toggle="true"
        >
          {viewMode === EXERCISE_VIEW_MODES.TOP_SET ? (
            recentEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No entries for this exercise yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {recentEntries.map((entry) => (
                  <li key={`${entry.date}-${entry.weight}-${entry.reps}-${entry.note ?? ""}`} className="flex items-center gap-3">
                    <div className="min-w-[110px]">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.date}</p>
                      {entry.note ? <p className="text-xs italic text-slate-500">{entry.note}</p> : null}
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
            )
          ) : visibleWorkouts.length === 0 ? (
            <p className="text-sm text-slate-500">No entries for this exercise yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {visibleWorkouts.map((workout) => {
                const isExpanded = expandedWorkouts.has(workout.date);
                const volumeText = `${formatVolume(workout.volume)}`;
                return (
                  <li key={workout.date} className="py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-none px-1 py-1 text-left text-slate-700 hover:bg-transparent dark:text-slate-200"
                      onClick={() => toggleWorkoutDetails(workout.date)}
                      aria-expanded={isExpanded}
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{workout.date}</span>
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {workout.setsCount} set{workout.setsCount === 1 ? "" : "s"}
                      </span>
                      <span className="flex-1 text-right font-semibold text-slate-700 dark:text-slate-100">{volumeText}</span>
                      <span className={`material-icons-round text-base text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </button>
                    {isExpanded && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-200">
                        {workout.sets.map((set) => (
                          <li key={`${workout.date}-${set.weight}-${set.reps}-${set.note ?? ""}`} className="flex items-center gap-2">
                            <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">
                              {formatWeight(set.weight)} × {set.reps}
                            </span>
                            {set.note ? <span className="text-[11px] italic text-slate-500">{set.note}</span> : null}
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-red-500 dark:bg-slate-800"
                              onClick={(event) => handleDeleteEntry(set, event)}
                              aria-label="Delete set"
                            >
                              <span className="material-icons-round text-[14px]">close</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <button
                type="button"
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                  canMoveUp ? "text-slate-500 hover:text-primary" : "cursor-not-allowed text-slate-300"
                }`}
                onClick={(event) => handleMove("up", event)}
                disabled={!canMoveUp}
                title="Move up"
                aria-label="Move exercise up"
              >
                <span className="material-icons-round text-base leading-none">expand_less</span>
              </button>
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true"></span>
              <button
                type="button"
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                  canMoveDown ? "text-slate-500 hover:text-primary" : "cursor-not-allowed text-slate-300"
                }`}
                onClick={(event) => handleMove("down", event)}
                disabled={!canMoveDown}
                title="Move down"
                aria-label="Move exercise down"
              >
                <span className="material-icons-round text-base leading-none">expand_more</span>
              </button>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-400 hover:text-red-500"
              data-dndkit-disable-dnd="true"
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
