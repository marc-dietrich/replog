// src/hooks/useSyncStatus.js
//
// Health polling + sync status hook.
// Periodically checks backend/db health and exposes connectivity state
// so the UI can render a status indicator.

import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../db/dexie";
import { checkHealth, processQueue, startPeriodicRetry, stopPeriodicRetry } from "../sync/queue";
import config from "virtual:app-config";

const { health: healthCfg, sync: syncCfg } = config;

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [backendStatus, setBackendStatus] = useState("unknown"); // "up" | "down" | "db-down" | "offline" | "unknown"
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const busyRef = useRef(false);

  // Reactively count pending sync items
  const pendingCount = useLiveQuery(() => db.syncQueue.count(), []) ?? 0;

  // ── Device online/offline ──────────────────────────────────────────────

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ── Health polling ─────────────────────────────────────────────────────

  useEffect(() => {
    let timer;

    async function poll() {
      const status = await checkHealth();
      setBackendStatus(status);
    }

    poll(); // immediate first check
    timer = setInterval(poll, healthCfg.pollIntervalMs);

    return () => clearInterval(timer);
  }, []);

  // ── Retry sync when connectivity returns ───────────────────────────────

  useEffect(() => {
    if (isOnline && (backendStatus === "up")) {
      processQueue().then(() => {
        setLastSyncedAt(Date.now());
      });
    }
  }, [isOnline, backendStatus]);

  // ── Periodic retry ─────────────────────────────────────────────────────

  useEffect(() => {
    startPeriodicRetry(syncCfg.retryIntervalMs);
    return () => stopPeriodicRetry();
  }, []);

  // ── Manual force sync ──────────────────────────────────────────────────

  const forceSync = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await processQueue();
      setLastSyncedAt(Date.now());
    } finally {
      busyRef.current = false;
    }
  }, []);

  return {
    isOnline,
    backendStatus,
    canSync: backendStatus === "up",
    pendingCount,
    lastSyncedAt,
    forceSync,
  };
}
