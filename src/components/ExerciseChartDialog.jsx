// src/components/ExerciseChartDialog.jsx
//
// Large chart dialog for a single exercise. Loads ALL entries for the
// exercise from the local Dexie database (not just the sparkline window),
// renders a "proper" chart: grid, 0-based Y axis, tooltips.

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db, QUEUE_STATUS } from "../db/db";
import { api } from "../hooks/api/client";
import { buildWorkoutTimeline } from "../utils/workoutMetrics";
import {
  EXERCISE_VIEW_MODES,
  SETS_DISPLAY_MODES,
} from "./ExerciseTrendChart";
import { SetsTrendChart } from "./SetsTrendChart";
import "../styles/componentStyles.css";

const GOLD = "#f7b733";
const SERVER_PAGE_SIZE = 200;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--chart-label-bg)",
  border: "1px solid var(--chart-label-border)",
  borderRadius: 10,
  color: "var(--chart-label-text)",
  fontSize: 12,
};

function formatWeight(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value} kg`;
}

export function ExerciseChartDialog({
  exerciseId,
  exerciseName,
  viewMode = EXERCISE_VIEW_MODES.TOP_SET,
  setsDisplayMode = SETS_DISPLAY_MODES.CONTINUOUS,
  onClose,
}) {
  // All entries of this exercise from the local database.
  const localEntries = useLiveQuery(
    () => db.entries.where("exerciseId").equals(exerciseId).sortBy("date"),
    [exerciseId],
    []
  );

  // UUIDs with open (unsynced) queue ops — their local version wins.
  const openOpUuids = useLiveQuery(
    async () => {
      const ops = await db.queue
        .where("status")
        .anyOf(QUEUE_STATUS.PENDING, QUEUE_STATUS.SYNCING, QUEUE_STATUS.FAILED)
        .toArray();
      return new Set(ops.map((op) => op.entityUuid));
    },
    [],
    new Set()
  );

  // Full history for this exercise from the backend, paginated until done.
  const [serverEntries, setServerEntries] = useState([]);
  const [serverTotal, setServerTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const collected = [];
      let offset = 0;
      let total = 0;
      try {
        do {
          const page = await api.get(
            `/exercises/${exerciseId}/entries?offset=${offset}&limit=${SERVER_PAGE_SIZE}`
          );
          collected.push(...(page.entries ?? []));
          total = page.totalCount ?? 0;
          offset += SERVER_PAGE_SIZE;
        } while (collected.length < total);
        if (!cancelled) {
          setServerEntries(collected);
          setServerTotal(total);
        }
      } catch (err) {
        // Offline/anonymous — local data still works.
        console.error("[chart] server fetch failed:", err.message);
        if (!cancelled) {
          setServerEntries([]);
          setServerTotal(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // Merge: server wins, except for entries with open queue ops — those
  // keep their local (pending) version until acked.
  const entries = useMemo(() => {
    const byId = new Map();
    for (const entry of serverEntries) byId.set(entry.id, entry);
    for (const entry of localEntries ?? []) {
      if (!byId.has(entry.id) || openOpUuids.has(entry.id)) {
        byId.set(entry.id, entry);
      }
    }
    return [...byId.values()].sort((a, b) =>
      String(a.date ?? "").localeCompare(String(b.date ?? ""))
    );
  }, [serverEntries, localEntries, openOpUuids]);

  const isSetsView = viewMode === EXERCISE_VIEW_MODES.SETS;
  const resolvedViewMode = isSetsView ? EXERCISE_VIEW_MODES.TOP_SET : viewMode;
  const isVolume = resolvedViewMode === EXERCISE_VIEW_MODES.VOLUME;

  const workouts = useMemo(() => buildWorkoutTimeline(entries ?? []), [entries]);

  const chartData = useMemo(
    () =>
      workouts.map((workout) => ({
        date: workout.date,
        bestWeight: workout.bestSet?.weight ?? 0,
        bestReps: workout.bestSet?.reps ?? 0,
        volume: Math.round((workout.volume ?? 0) * 10) / 10,
        setsCount: workout.setsCount,
      })),
    [workouts]
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const metricLabel = isSetsView
    ? "Sets"
    : isVolume
      ? "Volume"
      : "Top set";

  return (
    <div
      className="chart-dialog-overlay"
      data-no-toggle="true"
      onClick={(event) => {
        // Never bubble into the card's toggle handler.
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="chart-dialog-card"
        role="dialog"
        aria-label={`${exerciseName} full chart`}
      >
        <div className="chart-dialog__head">
          <div>
            <h3 className="chart-dialog__title">{exerciseName}</h3>
            <p className="chart-dialog__subtitle">
              {metricLabel} · {workouts.length} workouts · {entries.length} entries
              {loading && " · loading from server…"}
              {!loading && serverTotal != null && entries.length < serverTotal
                ? ` · ${serverTotal} on server`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="chart-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>

        <div className="chart-dialog__body">
          {isSetsView ? (
            <SetsTrendChart entries={entries} displayMode={setsDisplayMode} />
          ) : entries.length === 0 ? (
            <p className="chart-dialog__empty">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid, #cbd5e1)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  allowDecimals={!isVolume}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) =>
                    isVolume
                      ? [formatWeight(value), "Volume"]
                      : [formatWeight(value), "Top set"]
                  }
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="linear"
                  dataKey={isVolume ? "volume" : "bestWeight"}
                  stroke={GOLD}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill={GOLD}
                  fillOpacity={0.15}
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: GOLD, stroke: "#fff", strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: GOLD, stroke: "#fff", strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
