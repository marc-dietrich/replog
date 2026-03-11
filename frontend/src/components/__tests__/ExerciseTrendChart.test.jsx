// src/components/__tests__/ExerciseTrendChart.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExerciseTrendChart, EXERCISE_VIEW_MODES } from "../ExerciseTrendChart";
import { SETS_DISPLAY_MODES } from "../SetsTrendChart";

// Recharts uses ResizeObserver internally
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

const SAMPLE_ENTRIES = [
  { date: "2026-01-05", weight: 60, reps: 10, note: "" },
  { date: "2026-01-05", weight: 80, reps: 8, note: "" },
  { date: "2026-01-05", weight: 90, reps: 5, note: "Top set" },
  { date: "2026-01-08", weight: 60, reps: 10, note: "" },
  { date: "2026-01-08", weight: 85, reps: 8, note: "" },
  { date: "2026-01-08", weight: 95, reps: 4, note: "" },
  { date: "2026-01-12", weight: 60, reps: 10, note: "" },
  { date: "2026-01-12", weight: 90, reps: 8, note: "" },
  { date: "2026-01-12", weight: 100, reps: 3, note: "PR!" },
];

describe("ExerciseTrendChart", () => {
  it("renders 'No data yet' when entries are empty", () => {
    render(
      <ExerciseTrendChart
        entries={[]}
        viewMode={EXERCISE_VIEW_MODES.TOP_SET}
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders a chart container when entries are provided (Top-Set mode)", () => {
    const { container } = render(
      <ExerciseTrendChart
        entries={SAMPLE_ENTRIES}
        viewMode={EXERCISE_VIEW_MODES.TOP_SET}
      />
    );
    // Should render the chart wrapper div, not "No data"
    expect(container.querySelector(".exercise-trend-chart")).toBeInTheDocument();
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });

  it("renders a chart container in Volume mode", () => {
    const { container } = render(
      <ExerciseTrendChart
        entries={SAMPLE_ENTRIES}
        viewMode={EXERCISE_VIEW_MODES.VOLUME}
      />
    );
    expect(container.querySelector(".exercise-trend-chart")).toBeInTheDocument();
  });

  it("renders SetsTrendChart in Sets mode (continuous)", () => {
    const { container } = render(
      <ExerciseTrendChart
        entries={SAMPLE_ENTRIES}
        viewMode={EXERCISE_VIEW_MODES.SETS}
        setsDisplayMode={SETS_DISPLAY_MODES.CONTINUOUS}
      />
    );
    // In Sets mode, it delegates to SetsTrendChart which also renders the
    // chart wrapper class or "No data"
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });

  it("renders SetsTrendChart in Sets mode (discrete)", () => {
    const { container } = render(
      <ExerciseTrendChart
        entries={SAMPLE_ENTRIES}
        viewMode={EXERCISE_VIEW_MODES.SETS}
        setsDisplayMode={SETS_DISPLAY_MODES.DISCRETE}
      />
    );
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });

  it("defaults to Top-Set view mode", () => {
    const { container } = render(
      <ExerciseTrendChart entries={SAMPLE_ENTRIES} />
    );
    expect(container.querySelector(".exercise-trend-chart")).toBeInTheDocument();
  });
});
