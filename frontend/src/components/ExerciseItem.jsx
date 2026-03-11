import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXERCISE_VIEW_MODES, ExerciseTrendChart, SETS_DISPLAY_MODES } from "./ExerciseTrendChart";
import { buildWorkoutTimeline } from "../utils/workoutMetrics";
import "../styles/ExerciseItem.css";

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
  compact = false,
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

  const articleClassName = [
    "exercise-item",
    compact ? "exercise-item--compact" : "exercise-item--regular",
    isDragging
      ? "exercise-item--dragging"
      : isDragOverlay
        ? "exercise-item--drag-overlay"
        : isReordering
          ? "exercise-item--reordering"
          : "exercise-item--idle",
  ].join(" ");

  return (
    <article
      ref={cardRef}
      className={articleClassName}
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
      <div className={compact ? "exercise-item__quick-add-wrap exercise-item__quick-add-wrap--compact" : "exercise-item__quick-add-wrap"}>
        <button
          type="button"
          className={`exercise-item__quick-add-btn ${
            compact ? "exercise-item__quick-add-btn--compact" : ""
          } ${
            showQuickEntry ? "exercise-item__quick-add-btn--active" : ""
          }`}
          aria-label={showQuickEntry ? "Close quick entry" : "Add entry"}
          data-dndkit-disable-dnd="true"
          onClick={(event) => {
            event.stopPropagation();
            toggleQuickEntry(event);
          }}
        >
          <span className="material-icons-round exercise-item__quick-add-icon">add</span>
        </button>
      </div>
      <div className={compact ? "exercise-item__main exercise-item__main--compact" : "exercise-item__main"}>
        <div className={compact ? "exercise-item__head exercise-item__head--compact" : "exercise-item__head"}>
          <div className={`exercise-item__sparkline-wrap ${compact ? "exercise-item__sparkline-wrap--compact" : ""}`}>
            <svg
              viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
              className={`${compact ? "exercise-item__sparkline exercise-item__sparkline--compact" : "exercise-item__sparkline"}`}
              aria-hidden="true"
            >
              <path
                d={sparklineDisplayPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="exercise-item__sparkline-path"
              />
            </svg>
          </div>
          <div className="exercise-item__title-wrap">
            <h3 className={`exercise-item__title ${isOpen ? (compact ? "exercise-item__title--open-compact" : "exercise-item__title--open") : (compact ? "exercise-item__title--closed-compact" : "exercise-item__title--closed")}`}>
              {exercise.name}
            </h3>
            {!isOpen && (
              <p className={`${compact ? "exercise-item__last-entry exercise-item__last-entry--compact" : "exercise-item__last-entry"}`}>
                {lastEntry ? `Last: ${lastEntry.weight} kg × ${lastEntry.reps} • ${lastEntry.date}` : "No entries yet."}
              </p>
            )}
            {isOpen && (
              <div className="exercise-item__view-pill-wrap">
                <p className="exercise-item__view-pill">
                  <span className="exercise-item__view-pill-label">View</span>
                  <span>{viewModeLabel}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="exercise-item__chart-wrap"
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
          className="exercise-item__quick-entry"
          data-dndkit-disable-dnd="true"
          data-no-toggle="true"
          onKeyDownCapture={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="exercise-item__quick-entry-grid">
            <input
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="kg"
              step="0.5"
              min="0"
              className="exercise-item__quick-input"
            />
            <input
              type="number"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              placeholder="Reps"
              min="1"
              className="exercise-item__quick-input"
            />
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              className="exercise-item__quick-input exercise-item__quick-input--note"
            />
          </div>
          <div className="exercise-item__quick-actions">
            <button
              type="button"
              className="exercise-item__quick-cancel"
              onClick={(event) => {
                event.stopPropagation();
                resetQuickEntry();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="exercise-item__quick-save"
              onClick={handleAddEntry}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="exercise-item__details"
          data-dndkit-disable-dnd="true"
          data-no-toggle="true"
        >
          {viewMode === EXERCISE_VIEW_MODES.TOP_SET ? (
            recentEntries.length === 0 ? (
              <p className="exercise-item__empty-text">No entries for this exercise yet.</p>
            ) : (
              <ul className="exercise-item__entry-list">
                {recentEntries.map((entry) => (
                  <li key={`${entry.date}-${entry.weight}-${entry.reps}-${entry.note ?? ""}`} className="exercise-item__entry-row">
                    <div className="exercise-item__entry-date-wrap">
                      <p className="exercise-item__entry-date">{entry.date}</p>
                      {entry.note ? <p className="exercise-item__entry-note">{entry.note}</p> : null}
                    </div>
                    <div className="exercise-item__entry-main">
                      <span className="exercise-item__entry-main-value">
                        {entry.weight} kg × {entry.reps}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="exercise-item__entry-delete"
                      onClick={(event) => handleDeleteEntry(entry, event)}
                    >
                      <span className="material-icons-round exercise-item__entry-delete-icon">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : visibleWorkouts.length === 0 ? (
            <p className="exercise-item__empty-text">No entries for this exercise yet.</p>
          ) : (
            <ul className="exercise-item__workout-list">
              {visibleWorkouts.map((workout) => {
                const isExpanded = expandedWorkouts.has(workout.date);
                const volumeText = `${formatVolume(workout.volume)}`;
                return (
                  <li key={workout.date} className="exercise-item__workout-row">
                    <button
                      type="button"
                      className="exercise-item__workout-toggle"
                      onClick={() => toggleWorkoutDetails(workout.date)}
                      aria-expanded={isExpanded}
                    >
                      <span className="exercise-item__workout-date">{workout.date}</span>
                      <span className="exercise-item__workout-sets">
                        {workout.setsCount} set{workout.setsCount === 1 ? "" : "s"}
                      </span>
                      <span className="exercise-item__workout-volume">{volumeText}</span>
                      <span className={`material-icons-round exercise-item__workout-chevron ${isExpanded ? "exercise-item__workout-chevron--expanded" : ""}`}>
                        expand_more
                      </span>
                    </button>
                    {isExpanded && (
                      <ul className="exercise-item__set-list">
                        {workout.sets.map((set) => (
                          <li key={`${workout.date}-${set.weight}-${set.reps}-${set.note ?? ""}`} className="exercise-item__set-row">
                            <span className="exercise-item__set-main">
                              {formatWeight(set.weight)} × {set.reps}
                            </span>
                            {set.note ? <span className="exercise-item__set-note">{set.note}</span> : null}
                            <button
                              type="button"
                              className="exercise-item__set-delete"
                              onClick={(event) => handleDeleteEntry(set, event)}
                              aria-label="Delete set"
                            >
                              <span className="material-icons-round exercise-item__set-delete-icon">close</span>
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

          <div className="exercise-item__footer-actions">
            <div className="exercise-item__reorder-wrap">
              <button
                type="button"
                className={`exercise-item__reorder-btn ${
                  canMoveUp ? "exercise-item__reorder-btn--enabled" : "exercise-item__reorder-btn--disabled"
                }`}
                onClick={(event) => handleMove("up", event)}
                disabled={!canMoveUp}
                title="Move up"
                aria-label="Move exercise up"
              >
                <span className="material-icons-round exercise-item__reorder-icon">expand_less</span>
              </button>
              <span className="exercise-item__reorder-divider" aria-hidden="true"></span>
              <button
                type="button"
                className={`exercise-item__reorder-btn ${
                  canMoveDown ? "exercise-item__reorder-btn--enabled" : "exercise-item__reorder-btn--disabled"
                }`}
                onClick={(event) => handleMove("down", event)}
                disabled={!canMoveDown}
                title="Move down"
                aria-label="Move exercise down"
              >
                <span className="material-icons-round exercise-item__reorder-icon">expand_more</span>
              </button>
            </div>

            <button
              type="button"
              className="exercise-item__delete-btn"
              data-dndkit-disable-dnd="true"
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(DELETE_CONFIRM_MESSAGE)) {
                  onDeleteExercise?.(exercise.id);
                }
              }}
            >
              <span className="material-icons-round exercise-item__delete-btn-icon">delete</span>
              Delete exercise
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
