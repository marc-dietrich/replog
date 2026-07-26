// src/__tests__/repositories.test.js
//
// Tests for the IndexedDB CRUD layer (src/db/repositories.js).
// Uses fake-indexeddb so no real browser is needed.

import { describe, it, expect, beforeEach } from "vitest";
import db from "../db/dexie";
import {
  getAllGroups,
  createGroup,
  deleteGroup,
  updateGroupOrder,
  getAllExercises,
  getUngroupedExercises,
  getExercisesByGroup,
  createExercise,
  deleteExercise,
  updateExerciseOrder,
  getEntriesByExercise,
  createEntry,
  deleteEntry,
  replaceAllData,
} from "../db/repositories";

beforeEach(async () => {
  // Wipe all tables before each test
  await db.groups.clear();
  await db.exercises.clear();
  await db.entries.clear();
  await db.syncQueue.clear();
});

// ── Groups ─────────────────────────────────────────────────────────────────

describe("Group CRUD", () => {
  it("creates and reads a group", async () => {
    const id = await createGroup({ name: "Legs", order: 0 });

    const groups = await getAllGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Legs");
    expect(groups[0].id).toBe(id);
  });

  it("returns groups sorted by order", async () => {
    await createGroup({ name: "Push", order: 1 });
    await createGroup({ name: "Legs", order: 0 });
    await createGroup({ name: "Pull", order: 2 });

    const groups = await getAllGroups();
    expect(groups.map((g) => g.name)).toEqual(["Legs", "Push", "Pull"]);
  });

  it("deletes a group", async () => {
    const id = await createGroup({ name: "Legs", order: 0 });
    await deleteGroup(id);

    const groups = await getAllGroups();
    expect(groups).toHaveLength(0);
  });

  it("updates group order", async () => {
    const id = await createGroup({ name: "Legs", order: 0 });
    await updateGroupOrder(id, 5);

    const groups = await getAllGroups();
    expect(groups[0].order).toBe(5);
  });
});

// ── Exercises ──────────────────────────────────────────────────────────────

describe("Exercise CRUD", () => {
  it("creates and reads an exercise with entries attached", async () => {
    const exId = await createExercise({ name: "Squat", order: 0, groupId: null });
    await createEntry({
      date: "2026-07-26",
      weight: 100,
      reps: 5,
      note: "felt good",
      exerciseId: exId,
    });

    const exercises = await getAllExercises();
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe("Squat");
    expect(exercises[0].entries).toHaveLength(1);
    expect(exercises[0].entries[0].weight).toBe(100);
    expect(exercises[0].entries[0].note).toBe("felt good");
  });

  it("filters ungrouped exercises", async () => {
    const groupId = await createGroup({ name: "Legs", order: 0 });
    await createExercise({ name: "Squat", order: 0, groupId });
    await createExercise({ name: "Bench", order: 0, groupId: null });

    const ungrouped = await getUngroupedExercises();
    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0].name).toBe("Bench");
  });

  it("filters exercises by group", async () => {
    const groupId = await createGroup({ name: "Legs", order: 0 });
    await createExercise({ name: "Squat", order: 0, groupId });
    await createExercise({ name: "Leg Press", order: 1, groupId });
    await createExercise({ name: "Bench", order: 0, groupId: null });

    const legExercises = await getExercisesByGroup(groupId);
    expect(legExercises).toHaveLength(2);
    expect(legExercises.map((e) => e.name)).toEqual(["Squat", "Leg Press"]);
  });

  it("deletes an exercise and its child entries", async () => {
    const exId = await createExercise({ name: "Squat", order: 0, groupId: null });
    await createEntry({ date: "2026-07-26", weight: 100, reps: 5, note: "", exerciseId: exId });
    await createEntry({ date: "2026-07-25", weight: 95, reps: 5, note: "", exerciseId: exId });

    await deleteExercise(exId);

    const exercises = await getAllExercises();
    expect(exercises).toHaveLength(0);

    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(0);
  });

  it("updates exercise order and group", async () => {
    const exId = await createExercise({ name: "Squat", order: 0, groupId: null });
    const groupId = await createGroup({ name: "Legs", order: 0 });

    await updateExerciseOrder(exId, groupId, 3);

    const exercises = await getAllExercises();
    expect(exercises[0].order).toBe(3);
    expect(exercises[0].groupId).toBe(groupId);
  });
});

// ── Entries ────────────────────────────────────────────────────────────────

describe("Entry CRUD", () => {
  let exId;

  beforeEach(async () => {
    exId = await createExercise({ name: "Squat", order: 0, groupId: null });
  });

  it("creates and reads entries sorted by date desc", async () => {
    await createEntry({ date: "2026-07-24", weight: 90, reps: 5, note: "", exerciseId: exId });
    await createEntry({ date: "2026-07-26", weight: 100, reps: 5, note: "", exerciseId: exId });
    await createEntry({ date: "2026-07-25", weight: 95, reps: 5, note: "", exerciseId: exId });

    const entries = await getEntriesByExercise(exId);
    expect(entries).toHaveLength(3);
    // Newest first
    expect(entries[0].date).toBe("2026-07-26");
    expect(entries[1].date).toBe("2026-07-25");
    expect(entries[2].date).toBe("2026-07-24");
  });

  it("deletes an entry", async () => {
    const entryId = await createEntry({
      date: "2026-07-26",
      weight: 100,
      reps: 5,
      note: "",
      exerciseId: exId,
    });

    await deleteEntry(entryId);

    const entries = await getEntriesByExercise(exId);
    expect(entries).toHaveLength(0);
  });

  it("stores numeric weight and reps correctly", async () => {
    const id = await createEntry({
      date: "2026-07-26",
      weight: "100.5",
      reps: "8",
      note: "PR",
      exerciseId: exId,
    });

    const entries = await getEntriesByExercise(exId);
    expect(entries[0].weight).toBe(100.5);
    expect(entries[0].reps).toBe(8);
    expect(entries[0].note).toBe("PR");
  });
});

// ── Bulk operations ────────────────────────────────────────────────────────

describe("replaceAllData", () => {
  it("replaces all data atomically", async () => {
    // Seed some existing data
    await createGroup({ name: "Old Group", order: 0 });
    const oldExId = await createExercise({ name: "Old Exercise", order: 0, groupId: null });
    await createEntry({ date: "2026-07-20", weight: 50, reps: 10, note: "", exerciseId: oldExId });

    // Replace with new data
    await replaceAllData(
      [{ id: "g1", name: "New Group", order: 0 }],
      [
        {
          id: "e1",
          name: "New Exercise",
          order: 0,
          groupId: null,
          entries: [
            { id: "entry1", date: "2026-07-26", weight: 100, reps: 5, note: "good" },
          ],
        },
      ]
    );

    const groups = await getAllGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("New Group");

    const exercises = await getAllExercises();
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe("New Exercise");
    expect(exercises[0].entries).toHaveLength(1);
    expect(exercises[0].entries[0].weight).toBe(100);
  });

  it("handles empty data", async () => {
    await replaceAllData([], []);

    const groups = await getAllGroups();
    const exercises = await getAllExercises();
    expect(groups).toHaveLength(0);
    expect(exercises).toHaveLength(0);
  });
});
