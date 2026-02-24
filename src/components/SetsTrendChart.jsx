import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildWorkoutTimeline } from "../utils/workoutMetrics";

const GOLD = "#f7b733";
const MAX_SETS = 6;
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const CHART_COLORS = {
  labelBackground: "var(--chart-label-bg)",
  labelBorder: "var(--chart-label-border)",
  labelText: "var(--chart-label-text)",
  referenceLine: "var(--chart-reference-line)",
};

/** Generate opacity-graded gold colours – set 1 (top) is brightest. */
function setColor(index, total) {
  const maxOpacity = 1;
  const minOpacity = 0.1;
  const step = total > 1 ? (maxOpacity - minOpacity) / (total - 1) : 0;
  const opacity = maxOpacity - index * step;
  return `rgba(247, 183, 51, ${opacity.toFixed(2)})`;
}

/* ──────────────── Floating label (reused pattern from ExerciseTrendChart) ──────────────── */

function SetsLabel({ viewBox, valueText }) {
  if (!viewBox) return null;
  const { x = 0, y = 0, height = 0 } = viewBox;
  const lines = (valueText ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const paddingX = 6;
  const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const textWidth = longestLine * 6;
  const lineHeight = 12;
  const boxHeight = Math.max(18, lines.length * lineHeight + 6);
  const boxWidth = textWidth + paddingX * 2;
  const topThirdY = y + height * 0.25;
  const boxX = x - boxWidth / 2;
  const boxY = Math.max(0, topThirdY - boxHeight / 2);

  const lineCounts = new Map();

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
        {lines.map((line, i) => {
          const count = (lineCounts.get(line) ?? 0) + 1;
          lineCounts.set(line, count);
          return (
            <tspan key={`${line}-${count}`} x={x} dy={i === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          );
        })}
      </text>
    </g>
  );
}

/* ──────────────── Custom bar-shape with rounded tops ──────────────── */

function RoundedBar(props) {
  const { x, y, width, height, fill, isTopSegment } = props;
  if (!height || height <= 0) return null;
  const r = isTopSegment ? Math.min(4, width / 2, height) : 0;
  return (
    <path
      d={
        r > 0
          ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y}
             L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r}
             L${x + width},${y + height} Z`
          : `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`
      }
      fill={fill}
      stroke="rgba(255,255,255,0.4)"
      strokeWidth={0.5}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SETS TREND CHART
   ═══════════════════════════════════════════════════════════════════════ */

export const SETS_DISPLAY_MODES = Object.freeze({
  CONTINUOUS: "continuous",
  DISCRETE: "discrete",
});

export function SetsTrendChart({ entries, displayMode = SETS_DISPLAY_MODES.CONTINUOUS }) {
  const workouts = useMemo(() => buildWorkoutTimeline(entries), [entries]);

  /* Determine the global maximum number of sets across all workouts */
  const globalMaxSets = useMemo(() => {
    if (!workouts.length) return 1;
    return Math.min(MAX_SETS, Math.max(...workouts.map((w) => w.setsCount)));
  }, [workouts]);

  /* ── Data for the CONTINUOUS (area/line) variant ──
     rankedSets is already sorted descending by weight (best first).
     set1 = top-set, set2 = 2nd best, etc.  Values are ABSOLUTE weights.
     If a workout has fewer sets than globalMaxSets, missing ranks = 0.
     We render overlapping areas (no stackId) so lines never cross. */
  const continuousData = useMemo(() => {
    if (!workouts.length) return [];
    return workouts.map((workout) => {
      const row = { date: workout.date, _workout: workout };
      const uniqueRankedSets = workout.rankedSets.filter(
        (set, index, list) => index === list.findIndex((candidate) => candidate.weight === set.weight)
      );
      for (let i = 0; i < globalMaxSets; i++) {
        const set = uniqueRankedSets[i];
        row[`set${i + 1}`] = set ? set.weight : 0;
        row[`set${i + 1}_reps`] = set ? set.reps : 0;
      }
      return row;
    });
  }, [workouts, globalMaxSets]);

  /* ── Data for the DISCRETE (stacked bar) variant ──
     Build true stacked layers from LOWEST to HIGHEST so each layer top
     represents an absolute set weight. Example 50/30/20 => 20 + 10 + 20,
     producing visible tops at 20, 30, and 50 in a single stacked bar. */
  const discreteData = useMemo(() => {
    if (!workouts.length) return [];
    return workouts.map((workout) => {
      const row = { date: workout.date, _workout: workout };
      const ranked = [...workout.sets].sort((a, b) => {
        if (b.weight === a.weight) return b.reps - a.reps;
        return b.weight - a.weight;
      });
      const uniqueRanked = ranked.filter(
        (set, index, list) => index === list.findIndex((candidate) => candidate.weight === set.weight)
      );
      const sliced = uniqueRanked.slice(0, MAX_SETS);
      const ascending = [...sliced].reverse();
      let previousWeight = 0;
      ascending.forEach((set, index) => {
        row[`set${index + 1}`] = Math.max(0, set.weight - previousWeight);
        row[`set${index + 1}_abs`] = set.weight;
        row[`set${index + 1}_reps`] = set.reps;
        previousWeight = set.weight;
      });
      row._stackLayers = ascending.length;
      return row;
    });
  }, [workouts]);

  const chartData = displayMode === SETS_DISPLAY_MODES.CONTINUOUS ? continuousData : discreteData;

  /* ── Y-axis bounds ──
     Absolute weight values – just find the global min/max across all sets. */
  const yBounds = useMemo(() => {
    if (!workouts.length) return [0, 1];
    const allWeights = workouts.flatMap((w) =>
      w.rankedSets.map((s) => s.weight).filter(Number.isFinite)
    );
    if (!allWeights.length) return [0, 1];
    const globalMin = Math.min(...allWeights);
    const globalMax = Math.max(...allWeights);
    if (!Number.isFinite(globalMax)) return [0, 1];
    const lower = displayMode === SETS_DISPLAY_MODES.DISCRETE
      ? 0
      : Math.max(0, globalMin * 0.85);
    const upper = globalMax * 1.08 + 1;
    return [lower, upper];
  }, [workouts, displayMode]);

  /* ── Interaction state ── */
  const [activeIndex, setActiveIndex] = useState(null);
  const activeEntry = activeIndex == null ? null : chartData[activeIndex] ?? null;

  const handlePointerMove = useCallback(
    (state) => {
      if (typeof state?.activeTooltipIndex === "number") {
        setActiveIndex(state.activeTooltipIndex);
      }
    },
    []
  );

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  if (!chartData.length) {
    return <p className="text-center text-sm text-slate-400">No data yet</p>;
  }

  /* ── Label builder ── */
  const buildLabelText = () => {
    if (!activeEntry) return "";
    const workout = activeEntry._workout;
    if (!workout) return activeEntry.date ?? "";

    if (displayMode === SETS_DISPLAY_MODES.CONTINUOUS) {
      const lines = [activeEntry.date];
      const labels = ["Top", "2nd", "3rd", "4th", "5th", "6th"];
      const uniqueRankedSets = workout.rankedSets
        .filter((set, index, list) => index === list.findIndex((candidate) => candidate.weight === set.weight))
        .slice(0, globalMaxSets);
      uniqueRankedSets.forEach((set, i) => {
        lines.push(`${labels[i]} · ${NUMBER_FORMATTER.format(set.weight)} kg × ${set.reps}`);
      });
      return lines.join("\n");
    }

    // Discrete – show per-set weight × reps
    const lines = [activeEntry.date];
    const sorted = [...workout.sets]
      .sort((a, b) => {
        if (b.weight === a.weight) return b.reps - a.reps;
        return b.weight - a.weight;
      })
      .filter((set, index, list) => index === list.findIndex((candidate) => candidate.weight === set.weight))
      .slice(0, MAX_SETS);
    sorted.forEach((set, i) => {
      const label = i === 0 ? "Top" : `Set ${i + 1}`;
      lines.push(`${label} · ${NUMBER_FORMATTER.format(set.weight)} kg × ${set.reps}`);
    });
    return lines.join("\n");
  };

  /* ── Shared chart props ── */
  const sharedChartProps = {
    data: chartData,
    margin: { top: 10, right: 8, bottom: 4, left: 0 },
    onMouseMove: handlePointerMove,
    onTouchStart: handlePointerMove,
    onTouchMove: handlePointerMove,
    onMouseLeave: handlePointerLeave,
    onTouchEnd: handlePointerLeave,
    onClick: handlePointerMove,
  };

  const sharedXAxis = (
    <XAxis
      dataKey="date"
      interval="preserveStartEnd"
      axisLine={false}
      tickLine={false}
      tick={false}
      padding={displayMode === SETS_DISPLAY_MODES.CONTINUOUS ? { left: 15, right: 5 } : { left: 10, right: 10 }}
      minTickGap={12}
    />
  );

  const referenceLine = activeEntry && activeIndex != null && (
    <ReferenceLine
      x={activeEntry.date}
      stroke={CHART_COLORS.referenceLine}
      strokeWidth={1}
      strokeDasharray="2 3"
      strokeOpacity={0.95}
      isFront
      label={<SetsLabel valueText={buildLabelText()} />}
    />
  );

  /* ═════════════ CONTINUOUS MODE ═════════════
     Overlapping areas with absolute weights.
     Painted BACK to FRONT: set1 (top-set, tallest) first as background,
     then set2, set3… in front.  Because rank1 ≥ rank2 ≥ rank3 the areas
     naturally layer without crossing.  NO stackId. */
  if (displayMode === SETS_DISPLAY_MODES.CONTINUOUS) {
    const areaElements = [];
    // Paint lowest rank first and top-set last so strongest color stays visible
    for (let i = globalMaxSets; i >= 1; i--) {
      const key = `set${i}`;
      const isTop = i === 1;
      // Clear gradient: top-set = dense, lowest rank = lightest
      const t = globalMaxSets > 1 ? (i - 1) / (globalMaxSets - 1) : 0;
      const fillOp = 0.3 - t * 0.2; // 0.35 → 0.08
      const strokeOp = 1 - t * 0.6;   // 1.0  → 0.4
      areaElements.push(
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stroke={`rgba(247, 183, 51, ${strokeOp.toFixed(2)})`}
          strokeWidth={isTop ? 2.5 : 1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={GOLD}
          fillOpacity={fillOp}
          isAnimationActive={false}
          dot={isTop ? { r: 3, fill: GOLD, stroke: "#fff", strokeWidth: 1 } : false}
          activeDot={isTop ? { r: 4, fill: GOLD, stroke: "#fff", strokeWidth: 1 } : false}
          connectNulls
        />
      );
    }

    return (
      <div className="rounded-2xl border border-amber-50 bg-white/90 shadow-inner dark:border-amber-500/20 dark:bg-slate-900/50">
        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart {...sharedChartProps}>
              {sharedXAxis}
              <Tooltip cursor={false} wrapperStyle={{ display: "none" }} />
              <YAxis hide domain={yBounds} allowDecimals={false} padding={{ top: 4, bottom: 4 }} />
              {areaElements}
              {referenceLine}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  /* ═════════════ DISCRETE MODE ═════════════
     Single stacked bar per workout (no side-by-side bars).
     Layers are weight deltas so tops align with absolute set weights. */
  const barElements = [];
  for (let i = 1; i <= globalMaxSets; i++) {
    const key = `set${i}`;
    // Color is computed per bar from its actual layer-count, not globalMaxSets
    // so the top segment is always the darkest for that workout.
    barElements.push(
      <Bar
        key={key}
        dataKey={key}
        stackId="sets"
        fill={GOLD}
        stroke={GOLD}
        strokeWidth={0.5}
        isAnimationActive={false}
        radius={0}
        shape={(props) => {
          const layers = props.payload?._stackLayers ?? 0;
          if (!layers || i > layers) return null;
          const rankFromTop = layers - i; // top segment => 0 (darkest)
          return (
            <RoundedBar
              {...props}
              fill={setColor(rankFromTop, layers)}
              isTopSegment={i === layers}
            />
          );
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-amber-50 bg-white/90 shadow-inner dark:border-amber-500/20 dark:bg-slate-900/50">
      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart {...sharedChartProps} barCategoryGap="20%" barGap={0}>
            {sharedXAxis}
            <Tooltip cursor={false} wrapperStyle={{ display: "none" }} />
            <YAxis hide domain={yBounds} allowDecimals={false} padding={{ top: 4, bottom: 4 }} />
            {barElements}
            {referenceLine}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
