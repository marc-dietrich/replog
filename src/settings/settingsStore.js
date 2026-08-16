// src/settings/settingsStore.js
//
// Plain (non-React) access to the persisted UI settings, so modules like
// the sync engine can read them without hook context.

import config from "virtual:app-config";

const STORAGE_KEY = config.storage.settingsKey;

export function readUiSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * The user-configured per-exercise entries limit, falling back to the
 * configured default when unset/invalid.
 */
export function getEntriesLimit(fallback) {
  const value = Number(readUiSettings().entriesLimit);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
