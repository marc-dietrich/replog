// src/hooks/__tests__/useExercises.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExercises } from "../useExercises";

// Mock the API client so tests don't hit the network
vi.mock("../../api/client", () => ({
  dataApi: {
    put: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve({ exercises: [], groups: [], settings: {} })),
  },
}));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ──── Initial state ─────────────────────────────────────────

describe("useExercises – initial state", () => {
  it("starts with empty exercises, groups, and default settings", () => {
    const { result } = renderHook(() => useExercises());
    expect(result.current.exercises).toEqual([]);
    expect(result.current.groups).toEqual([]);
    expect(result.current.settings).toEqual({
      exerciseViewMode: "topSet",
      setsDisplayMode: "continuous",
    });
  });

  it("accepts serverState as initial data", () => {
    const serverState = {
      exercises: [
        { id: "1", name: "Bench Press", groupId: null, order: 0, entries: [] },
      ],
      groups: [],
      settings: { exerciseViewMode: "volume", setsDisplayMode: "discrete" },
    };
    const { result } = renderHook(() => useExercises(serverState));
    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0].name).toBe("Bench Press");
    expect(result.current.settings.exerciseViewMode).toBe("volume");
  });

  it("hydrates from localStorage when no serverState", () => {
    const stored = {
      exercises: [
        { id: "x1", name: "Squat", groupId: null, order: 0, entries: [] },
      ],
      groups: [],
      settings: { exerciseViewMode: "topSet", setsDisplayMode: "continuous" },
    };
    localStorage.setItem("gym-tracker-exercises", JSON.stringify(stored));
    const { result } = renderHook(() => useExercises());
    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0].name).toBe("Squat");
  });
});

// ──── addExercise ───────────────────────────────────────────

describe("useExercises – addExercise", () => {
  it("adds an exercise with the given name", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Bench Press"));
    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0].name).toBe("Bench Press");
    expect(result.current.exercises[0].entries).toEqual([]);
    expect(result.current.exercises[0].groupId).toBeNull();
  });

  it("trims whitespace from the name", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("  Deadlift  "));
    expect(result.current.exercises[0].name).toBe("Deadlift");
  });

  it("ignores empty/whitespace-only names", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise(""));
    act(() => result.current.addExercise("   "));
    expect(result.current.exercises).toHaveLength(0);
  });

  it("assigns the exercise to a group when groupId is given", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    const groupId = result.current.groups[0].id;
    act(() => result.current.addExercise("OHP", groupId));
    expect(result.current.exercises[0].groupId).toBe(groupId);
  });

  it("assigns sequential order within a group", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Ex1"));
    act(() => result.current.addExercise("Ex2"));
    act(() => result.current.addExercise("Ex3"));
    expect(result.current.exercises.map((e) => e.order)).toEqual([0, 1, 2]);
  });
});

// ──── addGroup ──────────────────────────────────────────────

describe("useExercises – addGroup", () => {
  it("adds a group with the given name", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe("Push");
  });

  it("trims whitespace", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("  Pull  "));
    expect(result.current.groups[0].name).toBe("Pull");
  });

  it("ignores empty names", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup(""));
    expect(result.current.groups).toHaveLength(0);
  });

  it("assigns sequential order", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    act(() => result.current.addGroup("Pull"));
    act(() => result.current.addGroup("Legs"));
    expect(result.current.groups.map((g) => g.order)).toEqual([0, 1, 2]);
  });
});

// ──── addEntry ──────────────────────────────────────────────

describe("useExercises – addEntry", () => {
  it("adds an entry to the specified exercise", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Bench Press"));
    const id = result.current.exercises[0].id;

    act(() => result.current.addEntry(id, "2026-01-05", 100, 5, "Top set"));

    const entries = result.current.exercises[0].entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      date: "2026-01-05",
      weight: 100,
      reps: 5,
      note: "Top set",
    });
  });

  it("converts weight and reps to numbers", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Squat"));
    const id = result.current.exercises[0].id;

    act(() => result.current.addEntry(id, "2026-01-05", "80", "8"));

    const entry = result.current.exercises[0].entries[0];
    expect(entry.weight).toBe(80);
    expect(entry.reps).toBe(8);
  });

  it("ignores entries with missing required fields", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Squat"));
    const id = result.current.exercises[0].id;

    act(() => result.current.addEntry(id, "", 80, 8));
    act(() => result.current.addEntry(id, "2026-01-05", null, 8));
    act(() => result.current.addEntry(id, "2026-01-05", 80, null));

    expect(result.current.exercises[0].entries).toHaveLength(0);
  });

  it("defaults note to empty string", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Squat"));
    const id = result.current.exercises[0].id;

    act(() => result.current.addEntry(id, "2026-01-05", 80, 8));

    expect(result.current.exercises[0].entries[0].note).toBe("");
  });

  it("accumulates multiple entries for the same exercise", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Squat"));
    const id = result.current.exercises[0].id;

    act(() => result.current.addEntry(id, "2026-01-05", 60, 10));
    act(() => result.current.addEntry(id, "2026-01-05", 80, 8));
    act(() => result.current.addEntry(id, "2026-01-05", 100, 5));

    expect(result.current.exercises[0].entries).toHaveLength(3);
  });
});

// ──── deleteEntry ───────────────────────────────────────────

describe("useExercises – deleteEntry", () => {
  it("deletes a matching entry", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Bench"));
    const id = result.current.exercises[0].id;
    act(() => result.current.addEntry(id, "2026-01-05", 80, 8, ""));
    act(() => result.current.addEntry(id, "2026-01-05", 100, 5, "Top"));

    act(() =>
      result.current.deleteEntry(id, {
        date: "2026-01-05",
        weight: 80,
        reps: 8,
        note: "",
      })
    );

    expect(result.current.exercises[0].entries).toHaveLength(1);
    expect(result.current.exercises[0].entries[0].weight).toBe(100);
  });
});

// ──── deleteExercise ────────────────────────────────────────

describe("useExercises – deleteExercise", () => {
  it("removes the exercise by id", () => {
    const { result } = renderHook(() => useExercises());
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("A"); });
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("B"); });
    const idA = result.current.exercises[0].id;
    const idB = result.current.exercises[1].id;
    expect(idA).not.toBe(idB);

    act(() => result.current.deleteExercise(idA));

    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0].name).toBe("B");
  });

  it("re-sequences order after deletion", () => {
    const { result } = renderHook(() => useExercises());
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("A"); });
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("B"); });
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("C"); });
    const idB = result.current.exercises[1].id;

    act(() => result.current.deleteExercise(idB));

    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.exercises.map((e) => e.order)).toEqual([0, 1]);
  });
});

// ──── deleteGroup ───────────────────────────────────────────

describe("useExercises – deleteGroup", () => {
  it("removes the group and ungroups its exercises", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    const groupId = result.current.groups[0].id;
    act(() => result.current.addExercise("Bench", groupId));

    act(() => result.current.deleteGroup(groupId));

    expect(result.current.groups).toHaveLength(0);
    expect(result.current.exercises[0].groupId).toBeNull();
  });
});

// ──── moveExercise ──────────────────────────────────────────

describe("useExercises – moveExercise", () => {
  it("moves exercise between groups", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    act(() => result.current.addGroup("Pull"));
    const pushId = result.current.groups[0].id;
    const pullId = result.current.groups[1].id;
    act(() => result.current.addExercise("Bench", pushId));

    const exId = result.current.exercises[0].id;
    act(() => result.current.moveExercise(exId, pullId, 0));

    expect(result.current.exercises[0].groupId).toBe(pullId);
  });

  it("reorders within the same group", () => {
    const { result } = renderHook(() => useExercises());
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("A"); });
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("B"); });
    act(() => { vi.advanceTimersByTime(1); result.current.addExercise("C"); });

    // Move A (index 0) to index 2 (end)
    const idA = result.current.exercises[0].id;
    act(() => result.current.moveExercise(idA, null, 2));

    const names = result.current.exercises
      .sort((a, b) => a.order - b.order)
      .map((e) => e.name);
    expect(names).toEqual(["B", "C", "A"]);
  });
});

// ──── Settings ──────────────────────────────────────────────

describe("useExercises – settings", () => {
  it("sets exercise view mode", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.setExerciseViewMode("volume"));
    expect(result.current.settings.exerciseViewMode).toBe("volume");
  });

  it("sets sets display mode", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.setSetsDisplayMode("discrete"));
    expect(result.current.settings.setsDisplayMode).toBe("discrete");
  });

  it("rejects invalid view modes", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.setExerciseViewMode("invalid"));
    expect(result.current.settings.exerciseViewMode).toBe("topSet"); // unchanged
  });

  it("rejects invalid sets display modes", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.setSetsDisplayMode("invalid"));
    expect(result.current.settings.setsDisplayMode).toBe("continuous"); // unchanged
  });
});

// ──── replaceState (import) ─────────────────────────────────

describe("useExercises – replaceState (data import)", () => {
  it("replaces the entire state", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("OldExercise"));

    const importedState = {
      exercises: [
        { id: "imp1", name: "Imported Bench", groupId: "g1", order: 0, entries: [] },
        { id: "imp2", name: "Imported Squat", groupId: "g1", order: 1, entries: [] },
      ],
      groups: [{ id: "g1", name: "Compounds", order: 0 }],
      settings: { exerciseViewMode: "sets", setsDisplayMode: "discrete" },
    };

    act(() => result.current.replaceState(importedState));

    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.exercises[0].name).toBe("Imported Bench");
    expect(result.current.exercises[1].name).toBe("Imported Squat");
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe("Compounds");
    expect(result.current.settings.exerciseViewMode).toBe("sets");
  });

  it("normalizes legacy array format on import", () => {
    const { result } = renderHook(() => useExercises());
    const legacyArray = [
      { id: "1", name: "Bench", entries: [{ date: "2026-01-01", weight: 80, reps: 5 }] },
    ];

    act(() => result.current.replaceState(legacyArray));

    expect(result.current.exercises).toHaveLength(1);
    expect(result.current.exercises[0].name).toBe("Bench");
    expect(result.current.exercises[0].groupId).toBeNull();
    expect(result.current.groups).toEqual([]);
  });

  it("persists imported state to localStorage", () => {
    const { result } = renderHook(() => useExercises());
    const importedState = {
      exercises: [{ id: "1", name: "Bench", groupId: null, order: 0, entries: [] }],
      groups: [],
      settings: { exerciseViewMode: "topSet", setsDisplayMode: "continuous" },
    };

    act(() => result.current.replaceState(importedState));

    const stored = JSON.parse(localStorage.getItem("gym-tracker-exercises"));
    expect(stored.exercises[0].name).toBe("Bench");
  });
});

// ──── Data export ───────────────────────────────────────────

describe("useExercises – data export shape", () => {
  it("exposes exercises, groups, settings suitable for JSON export", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addGroup("Push"));
    const groupId = result.current.groups[0].id;
    act(() => result.current.addExercise("Bench Press", groupId));
    const exId = result.current.exercises[0].id;
    act(() => result.current.addEntry(exId, "2026-01-05", 100, 5, "PR"));

    // Simulate what App.jsx does for export
    const payload = {
      exercises: result.current.exercises,
      groups: result.current.groups,
      settings: result.current.settings,
    };

    // Verify it round-trips through JSON
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);

    expect(parsed.exercises).toHaveLength(1);
    expect(parsed.exercises[0].name).toBe("Bench Press");
    expect(parsed.exercises[0].entries).toHaveLength(1);
    expect(parsed.exercises[0].entries[0]).toEqual({
      date: "2026-01-05",
      weight: 100,
      reps: 5,
      note: "PR",
    });
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.settings).toEqual({
      exerciseViewMode: "topSet",
      setsDisplayMode: "continuous",
    });
  });

  it("round-trips: export → import produces identical state", () => {
    const { result } = renderHook(() => useExercises());

    // Build up some data
    act(() => result.current.addGroup("Compounds"));
    const groupId = result.current.groups[0].id;
    act(() => result.current.addExercise("Squat", groupId));
    act(() => result.current.addExercise("Bench", groupId));
    const squatId = result.current.exercises[0].id;
    act(() => result.current.addEntry(squatId, "2026-01-05", 120, 5));
    act(() => result.current.addEntry(squatId, "2026-01-05", 140, 3));
    act(() => result.current.setExerciseViewMode("volume"));

    // Export
    const exported = JSON.parse(
      JSON.stringify({
        exercises: result.current.exercises,
        groups: result.current.groups,
        settings: result.current.settings,
      })
    );

    // Clear & re-import
    act(() => result.current.replaceState({ exercises: [], groups: [], settings: {} }));
    expect(result.current.exercises).toHaveLength(0);

    act(() => result.current.replaceState(exported));
    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.exercises[0].entries).toHaveLength(2);
    expect(result.current.settings.exerciseViewMode).toBe("volume");
  });
});

// ──── LocalStorage persistence ──────────────────────────────

describe("useExercises – localStorage sync", () => {
  it("saves state to localStorage on every change", () => {
    const { result } = renderHook(() => useExercises());
    act(() => result.current.addExercise("Bench"));

    const stored = JSON.parse(localStorage.getItem("gym-tracker-exercises"));
    expect(stored.exercises).toHaveLength(1);
    expect(stored.exercises[0].name).toBe("Bench");
  });
});
