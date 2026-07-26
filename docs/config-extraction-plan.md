# Config Extraction Plan

## Overview

Extract all hardcoded configuration values from both frontend and backend
into centralized, overridable config files:

- **Frontend**: `src/config.js` — plain JS module with named exports
- **Backend**: `application.yaml` + `@ConfigurationProperties` classes

---

## Frontend: `src/config.js`

### File location

```
src/config.js
```

### Structure

```js
// src/config.js
//
// Central configuration for the RepLog frontend.
// All tunable parameters live here so they can be adjusted in one place.
//
// In the future, values could be overridden via import.meta.env.VITE_* or
// fetched from a runtime /api/config endpoint.

const config = {
  // ── API ─────────────────────────────────────────────────────────────────
  apiBase: "/api",

  // ── Sync queue ─────────────────────────────────────────────────────────
  sync: {
    maxRetries: 10,
    baseDelayMs: 2000,
    maxDelayMs: 300_000,
    retryIntervalMs: 30_000,
  },

  // ── Health check ───────────────────────────────────────────────────────
  health: {
    cacheMs: 5000,
    fetchTimeoutMs: 3000,
    pollIntervalMs: 30_000,
  },

  // ── Entries ────────────────────────────────────────────────────────────
  entries: {
    defaultLimit: 10,
    loadMoreLimit: 200,
  },

  // ── Storage keys ───────────────────────────────────────────────────────
  storage: {
    dbName: "replog",
    tempIdPrefix: "temp_",
    settingsKey: "replog-ui-settings",
  },
};

export default config;
```

### What imports from `config.js`

| File | Values consumed |
|---|---|
| `sync/queue.js` | `apiBase`, `sync.*`, `health.cacheMs`, `health.fetchTimeoutMs` |
| `hooks/useExercises.js` | `apiBase`, `entries.*`, `sync.retryIntervalMs` |
| `hooks/useSyncStatus.js` | `health.pollIntervalMs`, `sync.retryIntervalMs` |
| `db/dexie.js` | `storage.dbName` |
| `db/repositories.js` | `storage.tempIdPrefix` |
| `hooks/useSettings.js` | `storage.settingsKey` |
| `hooks/api/client.js` | `apiBase` |

### Example: before vs after

```js
// BEFORE — sync/queue.js
const API_BASE = "/api";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 2000;
const HEALTH_CACHE_MS = 5000;

// AFTER — sync/queue.js
import config from "../config";
const { apiBase, sync, health } = config;
// Use: apiBase, sync.maxRetries, sync.baseDelayMs, health.cacheMs, ...
```

---

## Backend: `application.yaml` + `@ConfigurationProperties`

### New YAML structure

```yaml
# application.yaml (additions)
app:
  health:
    db-timeout-seconds: 3
  cors:
    allowed-origins:
      - http://localhost:5500
      - http://localhost:5173
    allowed-methods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
```

### New Java files

```
backend/src/main/java/made/simple/replog/config/
  AppHealthProperties.java    # @ConfigurationProperties("app.health")
  AppCorsProperties.java      # @ConfigurationProperties("app.cors")
```

### What changes

| File | Change |
|---|---|
| `HealthController.java` | Inject `AppHealthProperties`, use `properties.dbTimeoutSeconds()` |
| `CorsConfig.java` | Inject `AppCorsProperties`, use `properties.allowedOrigins()` / `allowedMethods()` |

### Before vs after (backend)

```java
// BEFORE — HealthController.java
dbUp = conn.isValid(3);  // magic number

// AFTER
dbUp = conn.isValid(healthProperties.dbTimeoutSeconds());
```

```java
// BEFORE — CorsConfig.java
configuration.setAllowedOrigins(List.of("http://localhost:5500"));

// AFTER
configuration.setAllowedOrigins(corsProperties.allowedOrigins());
```

---

## Migration steps

1. Create `src/config.js`
2. Update `sync/queue.js` to import from config
3. Update `useExercises.js` to import from config
4. Update `useSyncStatus.js` to import from config
5. Update `db/dexie.js` to import from config
6. Update `db/repositories.js` to import from config
7. Update `useSettings.js` to import from config
8. Update `api/client.js` to import from config
9. Create `AppHealthProperties.java`
10. Create `AppCorsProperties.java`
11. Update `application.yaml`
12. Update `HealthController.java`
13. Update `CorsConfig.java`
14. Update tests to use config where needed
15. Verify both builds
