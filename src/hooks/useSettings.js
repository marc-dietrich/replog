// src/hooks/useSettings.js
//
// UI-level preferences persisted in localStorage.
// These do NOT go through the backend – they are purely presentation concerns.

import { useState, useEffect } from "react";
import config from "virtual:app-config";

const STORAGE_KEY = config.storage.settingsKey;

export const EXERCISE_VIEW_MODES = Object.freeze({
  TOP_SET: "topSet",
  VOLUME: "volume",
  SETS: "sets",
});

export const SETS_DISPLAY_MODES = Object.freeze({
  CONTINUOUS: "continuous",
  DISCRETE: "discrete",
});

const DEFAULTS = Object.freeze({
  exerciseViewMode: EXERCISE_VIEW_MODES.TOP_SET,
  setsDisplayMode: SETS_DISPLAY_MODES.CONTINUOUS,
  entriesLimit: config.entries.defaultLimit,
});

const ENTRIES_LIMIT_MIN = 1;
const ENTRIES_LIMIT_MAX = 100;

function sanitiseEntriesLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULTS.entriesLimit;
  return Math.min(ENTRIES_LIMIT_MAX, Math.max(ENTRIES_LIMIT_MIN, Math.floor(parsed)));
}

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      exerciseViewMode: Object.values(EXERCISE_VIEW_MODES).includes(parsed.exerciseViewMode)
        ? parsed.exerciseViewMode
        : DEFAULTS.exerciseViewMode,
      setsDisplayMode: Object.values(SETS_DISPLAY_MODES).includes(parsed.setsDisplayMode)
        ? parsed.setsDisplayMode
        : DEFAULTS.setsDisplayMode,
      entriesLimit: sanitiseEntriesLimit(parsed.entriesLimit),
    };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setExerciseViewMode = (mode) => {
    if (!Object.values(EXERCISE_VIEW_MODES).includes(mode)) return;
    setSettings((prev) => ({ ...prev, exerciseViewMode: mode }));
  };

  const setSetsDisplayMode = (mode) => {
    if (!Object.values(SETS_DISPLAY_MODES).includes(mode)) return;
    setSettings((prev) => ({ ...prev, setsDisplayMode: mode }));
  };

  const setEntriesLimit = (limit) => {
    setSettings((prev) => ({ ...prev, entriesLimit: sanitiseEntriesLimit(limit) }));
  };

  return { settings, setExerciseViewMode, setSetsDisplayMode, setEntriesLimit };
}
