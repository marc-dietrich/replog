// src/utils/__tests__/workoutMetrics.test.js
import { describe, it, expect } from "vitest";
import {
  rankSetsByPerformance,
  getBestSet,
  getWorkoutVolume,
  buildWorkoutTimeline,
} from "../workoutMetrics";

// ──── rankSetsByPerformance ─────────────────────────────────

describe("rankSetsByPerformance", () => {
  it("returns empty array for empty input", () => {
    expect(rankSetsByPerformance([])).toEqual([]);
    expect(rankSetsByPerformance()).toEqual([]);
  });

  it("ranks by weight descending", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 100, reps: 3 },
      { weight: 80, reps: 8 },
    ];
    const ranked = rankSetsByPerformance(sets);
    expect(ranked[0].weight).toBe(100);
    expect(ranked[1].weight).toBe(80);
    expect(ranked[2].weight).toBe(60);
  });

  it("breaks ties by reps descending", () => {
    const sets = [
      { weight: 80, reps: 5 },
      { weight: 80, reps: 10 },
      { weight: 80, reps: 7 },
    ];
    const ranked = rankSetsByPerformance(sets);
    expect(ranked[0].reps).toBe(10);
    expect(ranked[1].reps).toBe(7);
    expect(ranked[2].reps).toBe(5);
  });

  it("does not mutate the original array", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 100, reps: 3 },
    ];
    const copy = [...sets];
    rankSetsByPerformance(sets);
    expect(sets).toEqual(copy);
  });
});

// ──── getBestSet ────────────────────────────────────────────

describe("getBestSet", () => {
  it("returns null for empty input", () => {
    expect(getBestSet([])).toBeNull();
    expect(getBestSet()).toBeNull();
  });

  it("returns the heaviest set", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 100, reps: 3 },
      { weight: 80, reps: 8 },
    ];
    expect(getBestSet(sets)).toEqual({ weight: 100, reps: 3 });
  });

  it("returns the set with more reps on tie", () => {
    const sets = [
      { weight: 80, reps: 5 },
      { weight: 80, reps: 8 },
    ];
    expect(getBestSet(sets)).toEqual({ weight: 80, reps: 8 });
  });
});

// ──── getWorkoutVolume ──────────────────────────────────────

describe("getWorkoutVolume", () => {
  it("returns 0 for empty input", () => {
    expect(getWorkoutVolume([])).toBe(0);
  });

  it("sums weight × reps for all sets", () => {
    const sets = [
      { weight: 100, reps: 5 },  // 500
      { weight: 80, reps: 8 },   // 640
      { weight: 60, reps: 12 },  // 720
    ];
    expect(getWorkoutVolume(sets)).toBe(500 + 640 + 720);
  });

  it("handles single set", () => {
    expect(getWorkoutVolume([{ weight: 50, reps: 10 }])).toBe(500);
  });
});

// ──── buildWorkoutTimeline ──────────────────────────────────

describe("buildWorkoutTimeline", () => {
  it("returns empty array for empty/invalid entries", () => {
    expect(buildWorkoutTimeline([])).toEqual([]);
    expect(buildWorkoutTimeline()).toEqual([]);
    expect(buildWorkoutTimeline(null)).toEqual([]);
  });

  it("groups entries by date", () => {
    const entries = [
      { date: "2026-01-05", weight: 60, reps: 10 },
      { date: "2026-01-05", weight: 80, reps: 8 },
      { date: "2026-01-08", weight: 60, reps: 10 },
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].date).toBe("2026-01-05");
    expect(timeline[0].sets).toHaveLength(2);
    expect(timeline[1].date).toBe("2026-01-08");
    expect(timeline[1].sets).toHaveLength(1);
  });

  it("sorts workouts chronologically", () => {
    const entries = [
      { date: "2026-02-01", weight: 100, reps: 3 },
      { date: "2026-01-01", weight: 60, reps: 10 },
      { date: "2026-01-15", weight: 80, reps: 8 },
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline.map((w) => w.date)).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-02-01",
    ]);
  });

  it("computes bestSet per workout", () => {
    const entries = [
      { date: "2026-01-05", weight: 60, reps: 10 },
      { date: "2026-01-05", weight: 90, reps: 5 },
      { date: "2026-01-05", weight: 80, reps: 8 },
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline[0].bestSet).toEqual(
      expect.objectContaining({ weight: 90, reps: 5 })
    );
  });

  it("computes volume per workout", () => {
    const entries = [
      { date: "2026-01-05", weight: 60, reps: 10 },  // 600
      { date: "2026-01-05", weight: 80, reps: 8 },   // 640
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline[0].volume).toBe(1240);
  });

  it("computes setsCount per workout", () => {
    const entries = [
      { date: "2026-01-05", weight: 60, reps: 10 },
      { date: "2026-01-05", weight: 80, reps: 8 },
      { date: "2026-01-05", weight: 90, reps: 5 },
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline[0].setsCount).toBe(3);
  });

  it("provides rankedSets in descending performance order", () => {
    const entries = [
      { date: "2026-01-05", weight: 60, reps: 10 },
      { date: "2026-01-05", weight: 90, reps: 5 },
      { date: "2026-01-05", weight: 80, reps: 8 },
    ];
    const timeline = buildWorkoutTimeline(entries);
    const weights = timeline[0].rankedSets.map((s) => s.weight);
    expect(weights).toEqual([90, 80, 60]);
  });

  it("handles entries with missing date gracefully", () => {
    const entries = [
      { date: "", weight: 60, reps: 10 },
      { date: "2026-01-05", weight: 80, reps: 8 },
      { weight: 70, reps: 7 }, // no date prop at all
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].date).toBe("2026-01-05");
  });

  it("normalizes string weight/reps to numbers", () => {
    const entries = [
      { date: "2026-01-05", weight: "80", reps: "8" },
    ];
    const timeline = buildWorkoutTimeline(entries);
    expect(timeline[0].bestSet.weight).toBe(80);
    expect(timeline[0].bestSet.reps).toBe(8);
  });
});
