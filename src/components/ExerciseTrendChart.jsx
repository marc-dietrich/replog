import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildWorkoutTimeline } from "../utils/workoutMetrics";

const GOLD = "#f7b733";
const CHART_COLORS = {
  labelBackground: "var(--chart-label-bg)",
  labelBorder: "var(--chart-label-border)",
  labelText: "var(--chart-label-text)",
  referenceLine: "var(--chart-reference-line)",
};
const AXIS_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const EXERCISE_VIEW_MODES = Object.freeze({
  TOP_SET: "topSet",
  VOLUME: "volume",
  SETS: "sets",
});

function formatAxisTick(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : AXIS_DATE_FORMATTER.format(date);
}

function WeightLabel({ viewBox, valueText }) {
  if (!viewBox) return null;
  const { x = 0, y = 0, height = 0 } = viewBox;
  const lines = (valueText ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const paddingX = 6;
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const textWidth = longestLine * 6; // approx width per character
  const lineHeight = 12;
  const boxHeight = Math.max(18, lines.length * lineHeight + 6);
  const boxWidth = textWidth + paddingX * 2;
  const topThirdY = y + height * 0.25;
  const boxX = x - boxWidth / 2;
  const boxY = Math.max(0, topThirdY - boxHeight / 2);

  return (
    <g>
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={boxHeight / 2}
        fill={CHART_COLORS.labelBackground}
        stroke={CHART_COLORS.labelBorder}
        strokeWidth={0.6}
      />
      <text
        x={x}
        y={boxY + boxHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 4}
        textAnchor="middle"
        fill={CHART_COLORS.labelText}
        fontSize={10}
        fontWeight={600}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={x} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function ExerciseTrendChart({ entries, viewMode = EXERCISE_VIEW_MODES.TOP_SET }) {
  const workouts = useMemo(() => buildWorkoutTimeline(entries), [entries]);

  const chartData = useMemo(() => {
    if (!workouts.length) return [];
    return workouts.map((workout) => {
      const [secondSet, thirdSet] = workout.rankedSets.slice(1, 3);
      return {
        date: workout.date,
        bestWeight: workout.bestSet?.weight ?? 0,
        bestReps: workout.bestSet?.reps ?? 0,
        volume: workout.volume,
        setsCount: workout.setsCount,
        rankedSets: workout.rankedSets,
        secondWeight: secondSet?.weight ?? null,
        thirdWeight: thirdSet?.weight ?? null,
        secondSet,
        thirdSet,
      };
    });
  }, [workouts]);

  const yBounds = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    let values = [];
    if (viewMode === EXERCISE_VIEW_MODES.TOP_SET) {
      values = chartData.map((entry) => entry.bestWeight);
    } else if (viewMode === EXERCISE_VIEW_MODES.VOLUME) {
      values = chartData.map((entry) => entry.volume);
    } else {
      values = chartData.flatMap((entry) =>
        [entry.bestWeight, entry.secondWeight, entry.thirdWeight].filter((value) => typeof value === "number" && value !== null)
      );
    }
    if (!values.length) return [0, 1];
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return [0, 1];
    }
    let lower = minValue * 0.95;
    let upper = maxValue * 1.05;
    if (minValue === maxValue) {
      lower = minValue * 0.95 - 1;
      upper = maxValue * 1.05 + 1;
    }
    return [Math.max(0, lower), upper];
  }, [chartData, viewMode]);

  const [activeIndex, setActiveIndex] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);
  const [chartOpacity, setChartOpacity] = useState(1);

  const handlePointerMove = useCallback((state) => {
    if (typeof state?.activeTooltipIndex === "number") {
      const nextIndex = state.activeTooltipIndex;
      setActiveIndex(nextIndex);
      setActiveEntry(chartData[nextIndex] ?? null);
    }
  }, [chartData]);

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null);
    setActiveEntry(null);
  }, []);

  useEffect(() => {
    setChartOpacity(0);
    const timer = setTimeout(() => setChartOpacity(1), 20);
    return () => clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    setActiveIndex(null);
    setActiveEntry(null);
  }, [viewMode]);

  if (chartData.length === 0) {
    return <p className="text-center text-sm text-slate-400">No data yet</p>;
  }

  useEffect(() => {
    if (activeIndex == null) {
      setActiveEntry(null);
    } else {
      setActiveEntry(chartData[activeIndex] ?? null);
    }
  }, [activeIndex, chartData]);

  const buildLabelText = useCallback(() => {
    if (!activeEntry) return "";
    if (viewMode === EXERCISE_VIEW_MODES.VOLUME) {
      const totalVolume = NUMBER_FORMATTER.format(activeEntry.volume);
      const setLabel = activeEntry.setsCount === 1 ? "set" : "sets";
      return `${activeEntry.date}\n${totalVolume} kg\n${activeEntry.setsCount} ${setLabel}`;
    }
    if (viewMode === EXERCISE_VIEW_MODES.SETS) {
      const lines = [activeEntry.date];
      const labels = ["Best", "2nd", "3rd"];
      activeEntry.rankedSets.slice(0, 3).forEach((set, index) => {
        lines.push(`${labels[index]} · ${NUMBER_FORMATTER.format(set.weight)} kg × ${set.reps}`);
      });
      return lines.join("\n");
    }
    return `${activeEntry.date}\n${NUMBER_FORMATTER.format(activeEntry.bestWeight)} kg × ${activeEntry.bestReps}`;
  }, [activeEntry, viewMode]);

  const currentDataKey = viewMode === EXERCISE_VIEW_MODES.VOLUME ? "volume" : "bestWeight";

  return (
    <div className="rounded-2xl border border-amber-50 bg-white/90 shadow-inner dark:border-amber-500/20 dark:bg-slate-900/50">
      <div className="px-2 py-4" style={{ transition: "opacity 180ms ease", opacity: chartOpacity }}>
        <ResponsiveContainer width="100%" height={180}>
        <AreaChart
            data={chartData}
          margin={{ top: 10, right: 8, bottom: 4, left: 0 }}
          onMouseMove={handlePointerMove}
          onTouchStart={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onTouchEnd={handlePointerLeave}
          onClick={handlePointerMove}
        >
          <XAxis
            dataKey="date"
            interval="preserveStartEnd"
            //tickFormatter={formatAxisTick}
            axisLine={false}
            tickLine={false}
            tick={false} // { fontSize: 11, fill: "#94a3b8" }}
            padding={{ left: 15, right: 5 }}
            minTickGap={12}
          />
          <Tooltip cursor={false} wrapperStyle={{ display: "none" }} />
          <YAxis
            hide
            domain={yBounds}
            allowDecimals={false}
            padding={{ top: 4, bottom: 4 }}
          />
          {viewMode === EXERCISE_VIEW_MODES.SETS ? (
            <>
              <Area
                type="linear"
                dataKey="bestWeight"
                stroke={GOLD}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill={GOLD}
                fillOpacity={0.12}
                isAnimationActive={false}
                dot={{ r: 3.5, fill: GOLD, stroke: "#fff", strokeWidth: 1 }}
                activeDot={{ r: 4.5, fill: GOLD, stroke: "#fff", strokeWidth: 1 }}
              />
              <Area
                type="linear"
                dataKey="secondWeight"
                stroke="rgba(247, 183, 51, 0.7)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="rgba(247, 183, 51, 0.15)"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
              <Area
                type="linear"
                dataKey="thirdWeight"
                stroke="rgba(247, 183, 51, 0.4)"
                strokeWidth={1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="rgba(247, 183, 51, 0.08)"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </>
          ) : (
            <Area
              type="linear"
              dataKey={currentDataKey}
              stroke={GOLD}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={GOLD}
              fillOpacity={0.15}
              isAnimationActive={false}
              dot={{ r: 3.5, fill: GOLD, stroke: "#fff", strokeWidth: 1 }}
              activeDot={{ r: 4.5, fill: GOLD, stroke: "#fff", strokeWidth: 1 }}
            />
          )}
          {activeEntry && (activeIndex || activeIndex === 0) && (
            <ReferenceLine
              x={activeEntry.date}
              stroke={CHART_COLORS.referenceLine}
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.95}
              isFront
              label={<WeightLabel valueText={buildLabelText()} />}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
