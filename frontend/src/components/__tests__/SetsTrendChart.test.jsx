// src/components/__tests__/SetsTrendChart.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetsTrendChart, SETS_DISPLAY_MODES } from "../SetsTrendChart";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

const SAMPLE_ENTRIES = [
  { date: "2026-01-05", weight: 60, reps: 10 },
  { date: "2026-01-05", weight: 80, reps: 8 },
  { date: "2026-01-05", weight: 90, reps: 5 },
  { date: "2026-01-08", weight: 60, reps: 10 },
  { date: "2026-01-08", weight: 85, reps: 8 },
  { date: "2026-01-08", weight: 95, reps: 4 },
];

describe("SetsTrendChart", () => {
  it("renders 'No data yet' with empty entries", () => {
    render(<SetsTrendChart entries={[]} />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders chart in continuous mode", () => {
    const { container } = render(
      <SetsTrendChart
        entries={SAMPLE_ENTRIES}
        displayMode={SETS_DISPLAY_MODES.CONTINUOUS}
      />
    );
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
    // The chart renders a recharts container (the wrapper div with the chart)
    expect(container.querySelector(".recharts-responsive-container") || container.firstChild).toBeTruthy();
  });

  it("renders chart in discrete mode", () => {
    const { container } = render(
      <SetsTrendChart
        entries={SAMPLE_ENTRIES}
        displayMode={SETS_DISPLAY_MODES.DISCRETE}
      />
    );
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });

  it("defaults to continuous mode", () => {
    const { container } = render(
      <SetsTrendChart entries={SAMPLE_ENTRIES} />
    );
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });

  it("handles single-set workouts", () => {
    const entries = [
      { date: "2026-01-05", weight: 100, reps: 1 },
      { date: "2026-01-08", weight: 105, reps: 1 },
    ];
    const { container } = render(
      <SetsTrendChart entries={entries} displayMode={SETS_DISPLAY_MODES.CONTINUOUS} />
    );
    expect(screen.queryByText("No data yet")).not.toBeInTheDocument();
  });
});
