// src/__tests__/useSettings.test.jsx
//
// Tests for useSettings (src/hooks/useSettings.js).
// Verifies localStorage persistence, defaults, and validation.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSettings,
  EXERCISE_VIEW_MODES,
  SETS_DISPLAY_MODES,
} from "../hooks/useSettings";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Defaults ─────────────────────────────────────────────────────────

  it("returns default exerciseViewMode when nothing is stored", () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.TOP_SET
    );
  });

  it("returns default setsDisplayMode when nothing is stored", () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.setsDisplayMode).toBe(
      SETS_DISPLAY_MODES.CONTINUOUS
    );
  });

  // ── Persistence ──────────────────────────────────────────────────────

  it("persists settings to localStorage on change", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setExerciseViewMode(EXERCISE_VIEW_MODES.VOLUME);
    });

    const stored = JSON.parse(
      localStorage.getItem("replog-ui-settings")
    );
    expect(stored.exerciseViewMode).toBe(EXERCISE_VIEW_MODES.VOLUME);
  });

  it("reads settings from localStorage on init", () => {
    localStorage.setItem(
      "replog-ui-settings",
      JSON.stringify({
        exerciseViewMode: EXERCISE_VIEW_MODES.SETS,
        setsDisplayMode: SETS_DISPLAY_MODES.DISCRETE,
      })
    );

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.SETS
    );
    expect(result.current.settings.setsDisplayMode).toBe(
      SETS_DISPLAY_MODES.DISCRETE
    );
  });

  // ── Validation ───────────────────────────────────────────────────────

  it("rejects invalid exerciseViewMode values", () => {
    localStorage.setItem(
      "replog-ui-settings",
      JSON.stringify({ exerciseViewMode: "bogus" })
    );

    const { result } = renderHook(() => useSettings());

    // Should fall back to default
    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.TOP_SET
    );
  });

  it("rejects invalid setsDisplayMode values", () => {
    localStorage.setItem(
      "replog-ui-settings",
      JSON.stringify({ setsDisplayMode: "bogus" })
    );

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.setsDisplayMode).toBe(
      SETS_DISPLAY_MODES.CONTINUOUS
    );
  });

  it("falls back to defaults on corrupt JSON in localStorage", () => {
    localStorage.setItem("replog-ui-settings", "{not-valid-json");

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.TOP_SET
    );
  });

  it("setExerciseViewMode ignores invalid mode values", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setExerciseViewMode("invalid-mode");
    });

    // Should remain at default
    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.TOP_SET
    );
  });

  it("setSetsDisplayMode ignores invalid mode values", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setSetsDisplayMode("invalid-mode");
    });

    expect(result.current.settings.setsDisplayMode).toBe(
      SETS_DISPLAY_MODES.CONTINUOUS
    );
  });

  // ── Multiple settings ────────────────────────────────────────────────

  it("preserves other settings when changing one", () => {
    localStorage.setItem(
      "replog-ui-settings",
      JSON.stringify({
        exerciseViewMode: EXERCISE_VIEW_MODES.VOLUME,
        setsDisplayMode: SETS_DISPLAY_MODES.DISCRETE,
      })
    );

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setExerciseViewMode(EXERCISE_VIEW_MODES.SETS);
    });

    expect(result.current.settings.exerciseViewMode).toBe(
      EXERCISE_VIEW_MODES.SETS
    );
    expect(result.current.settings.setsDisplayMode).toBe(
      SETS_DISPLAY_MODES.DISCRETE
    );
  });
});
