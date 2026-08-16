// src/hooks/useSyncStatus.js
//
// Online/backend health status + live pending-op count from the queue.
// The /api/health polling is a pure connectivity check — no sync trigger.

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, QUEUE_STATUS } from "../db/db";
import { retryFailedOps } from "../db/sync";
import config from "virtual:app-config";

const { health: healthCfg } = config;

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [backendStatus, setBackendStatus] = useState("unknown");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Live count of unsynced queue entries (pending/syncing/failed) —
  // same data basis as the logout warning dialog (G4).
  const pendingCount = useLiveQuery(
    () =>
      db.queue
        .where("status")
        .anyOf(QUEUE_STATUS.PENDING, QUEUE_STATUS.SYNCING, QUEUE_STATUS.FAILED)
        .count(),
    [],
    0
  );

  // Entries that gave up after max retries (manual recovery only).
  const failedCount = useLiveQuery(
    () => db.queue.where("status").equals(QUEUE_STATUS.FAILED).count(),
    [],
    0
  );

  // Manual recovery: reset failed ops and push the queue again.
  const retryFailed = useCallback(async () => {
    await retryFailedOps();
  }, []);

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

  useEffect(() => {
    let timer;

    async function poll() {
      try {
        const res = await fetch("/api/health", {
          signal: AbortSignal.timeout(healthCfg.fetchTimeoutMs),
          credentials: "include",
        });
        const data = await res.json();
        setBackendStatus(data.db === "UP" ? "up" : "db-down");
      } catch {
        setBackendStatus("down");
      }
    }

    poll();
    timer = setInterval(poll, healthCfg.pollIntervalMs);
    return () => clearInterval(timer);
  }, []);

  const forceSync = useCallback(async () => {
    try {
      const res = await fetch("/api/health", {
        signal: AbortSignal.timeout(healthCfg.fetchTimeoutMs),
        credentials: "include",
      });
      const data = await res.json();
      setBackendStatus(data.db === "UP" ? "up" : "db-down");
      if (data.db === "UP") setLastSyncedAt(Date.now());
    } catch {
      setBackendStatus("down");
    }
  }, []);

  return {
    isOnline,
    backendStatus,
    canSync: backendStatus === "up",
    pendingCount,
    failedCount,
    retryFailed,
    lastSyncedAt,
    forceSync,
  };
}
