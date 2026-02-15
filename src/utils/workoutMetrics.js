const SAFE_NUMBER = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SAFE_INT = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeEntry(entry) {
  const weight = SAFE_NUMBER(entry?.weight, 0);
  const reps = Math.max(0, SAFE_INT(entry?.reps, 0));
  const date = entry?.date || entry?.createdAt || "";
  return {
    ...entry,
    date,
    weight,
    reps,
    note: entry?.note ?? "",
  };
}

export function groupEntriesByWorkout(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const sorted = [...entries]
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => entry.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const map = new Map();
  sorted.forEach((entry) => {
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
    map.get(entry.date).push(entry);
  });

  return Array.from(map.entries()).map(([date, sets]) => ({ date, sets }));
}

export function rankSetsByPerformance(sets = []) {
  return [...sets].sort((a, b) => {
    if (b.weight === a.weight) {
      return b.reps - a.reps;
    }
    return b.weight - a.weight;
  });
}

export function getBestSet(sets = []) {
  const ranked = rankSetsByPerformance(sets);
  return ranked[0] ?? null;
}

export function getWorkoutVolume(sets = []) {
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

export function buildWorkoutTimeline(entries = []) {
  const grouped = groupEntriesByWorkout(entries);
  return grouped.map((workout) => {
    const rankedSets = rankSetsByPerformance(workout.sets);
    return {
      ...workout,
      rankedSets,
      bestSet: rankedSets[0] ?? null,
      volume: getWorkoutVolume(workout.sets),
      setsCount: workout.sets.length,
    };
  });
}
