// src/hooks/useSyncStatus.js
//
// Simplified health check + online status hook.
// No sync queue — just tells the UI whether the backend is reachable.

import { useState, useEffect, useCallback } from "react";
import config from "virtual:app-config";

const { health: healthCfg } = config;

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [backendStatus, setBackendStatus] = useState("unknown");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

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
    pendingCount: 0,
    lastSyncedAt,
    forceSync,
  };
}
