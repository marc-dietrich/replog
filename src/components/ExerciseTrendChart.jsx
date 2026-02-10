import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GOLD = "#f7b733";
const CHART_COLORS = {
  labelBackground: "var(--chart-label-bg)",
  labelBorder: "var(--chart-label-border)",
  labelText: "var(--chart-label-text)",
  referenceLine: "var(--chart-reference-line)",
};
const AXIS_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

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

export function ExerciseTrendChart({ entries }) {
  const data = useMemo(() => {
    if (!entries?.length) return [];
    return [...entries]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((entry) => ({
        date: entry.date,
        weight: Number(entry.weight),
        reps: Number(entry.reps),
      }));
  }, [entries]);

  const yBounds = useMemo(() => {
    if (data.length === 0) return [0, 1];
    const weights = data.map((entry) => entry.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight)) {
      return [0, 1];
    }
    let lower = minWeight * 0.99;
    let upper = maxWeight * 1.01;
    if (minWeight === maxWeight) {
      lower = minWeight * 0.99 - 1;
      upper = maxWeight * 1.01 + 1;
    }
    return [Math.max(0, lower), upper];
  }, [data]);

  const [activeIndex, setActiveIndex] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);

  const handlePointerMove = useCallback((state) => {
    if (typeof state?.activeTooltipIndex === "number") {
      const nextIndex = state.activeTooltipIndex;
      setActiveIndex(nextIndex);
      setActiveEntry(data[nextIndex] ?? null);
    }
  }, [data]);

  const handlePointerLeave = useCallback(() => {
    setActiveIndex(null);
    setActiveEntry(null);
  }, []);

  if (data.length === 0) {
    return <p className="text-center text-sm text-slate-400">No data yet</p>;
  }

  useEffect(() => {
    if (activeIndex == null) {
      setActiveEntry(null);
    } else {
      setActiveEntry(data[activeIndex] ?? null);
    }
  }, [activeIndex, data]);
  // const activeDate = activeEntry?.date ?? null;

  return (
    <div className="rounded-2xl border border-amber-50 bg-white/90 shadow-inner dark:border-amber-500/20 dark:bg-slate-900/50">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={data}
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
          <Area
            type="linear"
            dataKey="weight"
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
          {activeEntry && (activeIndex || activeIndex === 0) && (
            <ReferenceLine
              x={activeEntry.date}
              stroke={CHART_COLORS.referenceLine}
              strokeWidth={1}
              strokeDasharray="2 3"
              strokeOpacity={0.95}
              isFront
              label={<WeightLabel valueText={`${activeEntry.date}\n${activeEntry.weight}kg`} />}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
