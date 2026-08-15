# ⚠️ Veraltet / Deprecated (Q6)

Dieses Dokument ist **veraltet** und wird vollständig durch die Spec in
`README.md` ("Local-First Sync Engine — Spec", inkl. "Implementation
Decisions") ersetzt. Widersprüchliche Punkte (temp-IDs, 30s-Polling,
Server-Wins-Refresh) sind dort korrigiert. Bei Abweichungen gilt `README.md`.

---

# RepLog — Local-First Architecture Design (ALT)

## 1. Current State (Baseline)

```
┌──────────────┐     fetch on mount      ┌──────────────────┐
│   React UI   │ ◄────────────────────── │  Spring Boot API │
│              │ ──────────────────────► │                  │
│  useState()  │ mutate → wait → refetch │  PostgreSQL      │
└──────────────┘                         └──────────────────┘

No offline: ❌   No local cache: ❌   Optimistic: ❌
```

Every mutation does `await api.post(...)` → `await refresh()` (full re-fetch).  
The page is blank without a network connection.

---

## 2. Target Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│  ┌──────────┐   reads instantly   ┌───────────────┐ │
│  │ React UI │ ◄────────────────── │   IndexedDB   │ │
│  │          │ ──────────────────► │   (Dexie.js)  │ │
│  │ hooks    │  optimistic write   │               │ │
│  └──────────┘                     └──────┬────────┘ │
│                                          │           │
│                                   ┌──────▼────────┐ │
│                                   │  Sync Queue   │ │
│                                   │  (pending ops)│ │
│                                   └──────┬────────┘ │
│                                          │           │
└──────────────────────────────────────────┼───────────┘
                                           │ async
                                           ▼
                                  ┌──────────────────┐
                                  │  Spring Boot API │
                                  │  PostgreSQL      │
                                  └──────────────────┘
```

- **Reads**: Always from IndexedDB (instant, offline-capable).
- **Writes**: Optimistically to IndexedDB first → UI updates immediately → background sync to backend.
- **Sync**: A queue of pending mutations. On success → mark synced. On failure → retry later.

---

## 3. Technology Choice: Dexie.js

| Criterion | Dexie.js |
|---|---|
| API style | Promise-based, chainable, React-friendly |
| Schema / migrations | Built-in versioning with `version().stores()` |
| Querying | `where()`, `orderBy()`, compound indexes, `toArray()` |
| Live queries | `dexie-react-hooks` → `useLiveQuery()` subscribes to table changes |
| Bundle size | ~18 KB gzipped |
| Maintenance | Actively maintained, widely used |

Install: `npm install dexie dexie-react-hooks`

---

## 4. IndexedDB Schema

```js
// src/db/dexie.js
import Dexie from "dexie";

const db = new Dexie("replog");

db.version(1).stores({
  // ── Domain tables ──────────────────────────────────────
  groups:     "&id, name, order",
  exercises:  "&id, name, order, groupId",
  entries:    "&id, date, weight, reps, exerciseId",

  // ── Sync metadata ──────────────────────────────────────
  // Tracks which mutations haven't reached the server yet.
  syncQueue:  "++localId, entityType, entityId, operation, timestamp",
});
```

### Why this schema

- `&id` = unique primary key (the server UUID).
- Indexed fields (`groupId`, `exerciseId`, `date`) let us do filtered queries fast.
- `syncQueue` is an append-only log. Each row is:
  ```
  { entityType: "entry" | "exercise" | "group",
    entityId:   "uuid-or-temp-id",
    operation:  "create" | "update" | "delete",
    payload:    { ...full object for create/update... },
    timestamp:  Date.now(),
    retries:    0 }
  ```

### Local-only IDs for optimistic creates

When the user creates something, we don't have a server UUID yet. We generate a **local temp ID** (e.g. `temp_1699999999999`). The sync queue entry maps `tempId → serverId` once the server responds.

---

## 5. Healthcheck & Connectivity Awareness

### Why `navigator.onLine` alone is not enough

`navigator.onLine` only tells you if the device has a network interface — it doesn't
tell you whether the backend is actually reachable or the database is healthy.
The sync layer needs all three layers of awareness:

| Layer | Signal | What it means |
|---|---|---|
| Device | `navigator.onLine` | WiFi/Ethernet interface up |
| Backend | `GET /api/health` → 200 | Spring Boot is running |
| Database | `GET /api/health` → `{ db: "UP" }` | PostgreSQL is connected |

### Backend: new health endpoint

```
GET /api/health
```

Response:

```json
{
  "status": "UP",
  "db": "UP",
  "timestamp": "2026-07-26T12:00:00Z"
}
```

Possible states:

```
status=UP,   db=UP    → 🟢 fully operational — sync can run
status=UP,   db=DOWN  → 🟡 backend alive, DB dead — pause sync, warn user
status=DOWN  (no db)  → 🔴 backend down — pause sync entirely
no response           → 🔴 unreachable — same as offline
```

Implementation in Spring Boot (pseudo):

```java
@RestController
public class HealthController {
    private final DataSource dataSource;

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        boolean dbUp;
        try (var conn = dataSource.getConnection()) {
            dbUp = conn.isValid(2);
        } catch (Exception e) {
            dbUp = false;
        }
        return Map.of(
            "status", dbUp ? "UP" : "DOWN",
            "db", dbUp ? "UP" : "DOWN",
            "timestamp", Instant.now().toString()
        );
    }
}
```

Note: This endpoint must be **excluded from authentication** (public) so the
frontend can ping it before any user session exists.

### Frontend: `useHealthCheck` (integrated into `useSyncStatus`)

```js
// src/hooks/useSyncStatus.js

const HEALTH_POLL_INTERVAL = 30_000; // 30 seconds

function useSyncStatus() {
  const [backendStatus, setBackendStatus] = useState("unknown"); // "up" | "down" | "db-down" | "unknown"
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
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
    async function check() {
      if (!navigator.onLine) {
        setBackendStatus("offline");
        return;
      }
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (data.db === "UP") setBackendStatus("up");
        else setBackendStatus("db-down");
      } catch {
        setBackendStatus("down");
      }
    }
    check(); // immediate
    timer = setInterval(check, HEALTH_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // ...

  return {
    isOnline,           // boolean: device has network
    backendStatus,      // "up" | "down" | "db-down" | "offline" | "unknown"
    canSync: backendStatus === "up",  // convenience flag for the sync queue
    // ...pendingCount, lastSyncedAt, forceSync
  };
}
```

### How the sync queue uses this

```js
// In sync/queue.js — processQueue() checks health before attempting sync

async function processQueue() {
  if (!navigator.onLine) return;           // device offline → don't even try
  const health = await checkHealthQuick();  // lightweight: just check last known status
  if (health !== "up") return;             // backend/db down → skip, retry later

  // ... process pending items ...
}
```

When connectivity comes back (`online` event or healthcheck flips to `"up"`),
the sync queue is automatically triggered again.

### UI indicator

```
🟢 All synced                    — canSync && pendingCount === 0
🟡 3 pending sync                — canSync && pendingCount > 0
🟠 Backend unreachable, 5 queued — !canSync && pendingCount > 0
🔴 Offline                       — !isOnline
```

---

## 6. Paginated Entries — Lazy Loading per Exercise

### Problem

Today, `GET /api/groups/all` and `GET /api/exercises/ungrouped` return **all**
entries for every exercise. If a user has 200 squat entries, all 200 are loaded
on every page visit. This is wasteful for:
- **Network**: large payload on every refresh
- **IndexedDB**: storing hundreds of entries that are rarely viewed
- **UI**: the exercise card only shows the last ~5 entries anyway

### Design: "Last N + load more on demand"

```
Main listing (always loads)          Detail view (on demand)
┌─────────────────────────┐          ┌─────────────────────────┐
│ Exercise: Squat         │          │ Exercise: Squat         │
│ ┌─────────────────────┐ │          │ ┌─────────────────────┐ │
│ │ 2026-07-26  100×5   │ │          │ │ 2026-07-26  100×5   │ │
│ │ 2026-07-24   95×5   │ │          │ │ 2026-07-24   95×5   │ │
│ │ 2026-07-22  100×4   │ │  click   │ │ 2026-07-22  100×4   │ │
│ │         ...          │ │ ──────► │ │ 2026-07-20   90×5   │ │
│ │         ...          │ │ "Show   │ │ 2026-07-18   85×5   │ │
│ └─────────────────────┘ │  all"    │ │  ... (all 200 entries)│ │
│      [ Show all 200 ]   │          │ └─────────────────────┘ │
└─────────────────────────┘          └─────────────────────────┘
```

### Backend changes

**A) Existing endpoints get optional `entriesLimit` parameter**

```
GET /api/groups/all?entriesLimit=10
GET /api/exercises/ungrouped?entriesLimit=10
```

When `entriesLimit` is provided (default: unlimited for backward compat),
each exercise's `entries` array is capped to the **most recent** N entries.
The DTO stays the same — just the list is shorter.

If an exercise has exactly `entriesLimit` entries, the frontend assumes there
*might* be more (sets `hasMoreEntries = true`). This is a heuristic — the
real count is checked when loading more.

**B) New endpoint for paginated entry loading**

```
GET /api/exercises/{exerciseId}/entries?offset=0&limit=50
```

Returns:

```json
{
  "exerciseId": "abc-123",
  "entries": [
    { "id": "...", "date": "2026-07-26", "weight": 100, "reps": 5, "note": "" }
  ],
  "totalCount": 200,
  "offset": 0,
  "limit": 50
}
```

- `offset` + `limit` for cursor-based pagination (sorted by date DESC).
- `totalCount` lets the frontend know exactly how many exist (no heuristic needed).

Implementation in Spring Boot (pseudo):

```java
@GetMapping("/api/exercises/{exerciseId}/entries")
public PagedEntriesDto listEntries(
    @PathVariable UUID exerciseId,
    @RequestParam(defaultValue = "0") int offset,
    @RequestParam(defaultValue = "50") int limit
) {
    return entryService.listForExercise(exerciseId, offset, limit);
}
```

This endpoint does NOT need to be added to the healthcheck — it's a normal
authenticated data endpoint.

### Frontend: how IndexedDB handles this

No schema change needed — entries are already stored flat in the `entries` table.
The new behavior is in the repository layer:

```js
// src/db/repositories.js

const DEFAULT_ENTRIES_LIMIT = 10;

// Fetch initial data (main listing) — stores only last N entries per exercise
async function loadInitialData() {
  const [groupsData, ungroupedData] = await Promise.all([
    api.get(`/groups/all?entriesLimit=${DEFAULT_ENTRIES_LIMIT}`),
    api.get(`/exercises/ungrouped?entriesLimit=${DEFAULT_ENTRIES_LIMIT}`),
  ]);
  // ...store in IndexedDB...
}

// Fetch ALL entries for a specific exercise (detail view / "show all")
async function loadAllEntriesForExercise(exerciseId) {
  const page = await api.get(`/exercises/${exerciseId}/entries?offset=0&limit=200`);
  // Merge into IndexedDB entries table
  await db.entries.bulkPut(page.entries.map(e => ({ ...e, exerciseId })));
  return { totalCount: page.totalCount };
}
```

### Hook API addition

`useExercises` gets one new function:

```js
const {
  // ... existing ...
  loadMoreEntries,       // (exerciseId) => Promise<number> — returns totalCount
} = useExercises();
```

Usage in a component:

```jsx
function ExerciseItem({ exercise }) {
  const { loadMoreEntries } = useExercises();
  const [showingAll, setShowingAll] = useState(false);
  const [totalCount, setTotalCount] = useState(null);

  const handleShowAll = async () => {
    const count = await loadMoreEntries(exercise.id);
    setTotalCount(count);
    setShowingAll(true);
  };

  const displayedEntries = showingAll
    ? exercise.entries  // all entries now loaded in IndexedDB
    : exercise.entries.slice(0, 10);

  return (
    <div>
      {displayedEntries.map(e => <EntryRow key={e.id} entry={e} />)}
      {!showingAll && exercise.hasMoreEntries && (
        <button onClick={handleShowAll}>Show all</button>
      )}
    </div>
  );
}
```

Note: because `useLiveQuery` reacts to IndexedDB changes, after
`loadMoreEntries` writes the full set into the `entries` table, the
`exercise.entries` array in the hook automatically grows — no manual
state management needed.

### IndexedDB entry count consideration

Even with all 200 entries loaded into IndexedDB, this is negligible:
- 200 entries × ~200 bytes each = ~40 KB per exercise
- 10 exercises × 40 KB = 400 KB total
- IndexedDB can handle gigabytes

The `entriesLimit=10` default is about **network payload** and **initial
load speed**, not IndexedDB capacity. Once loaded, they stay cached.

---

## 7. File Structure

```
src/
  db/
    dexie.js              # Dexie instance + schema versioning
    repositories.js        # Pure CRUD on IndexedDB (no sync)
  sync/
    queue.js               # addToQueue(), processQueue(), retry logic
    reconciler.js          # optional: server-vs-local conflict resolution
  hooks/
    useExercises.js        # 🔄 Refactored: local-first + background sync
    useSyncStatus.js       # exposes { pendingCount, isOnline, backendStatus, canSync }
    index.js               # barrel exports (unchanged API surface)
```

backend/
  src/main/java/.../
    controller/
      HealthController.java   # NEW: GET /api/health
      ExerciseController.java # MODIFIED: entriesLimit param + entries pagination endpoint

---

## 8. The `repositories.js` Layer (IndexedDB CRUD)

Pure functions — no sync, no network. Just read/write IndexedDB.

```js
// src/db/repositories.js

// ── Groups ──
getAllGroups()           → groups sorted by order
getGroup(id)
createGroup({ id: tempId, name, order })
updateGroupOrder(id, newOrder)
deleteGroup(id)

// ── Exercises ──
getAllExercises()        → exercises with their entries embedded
getUngroupedExercises()
getExercisesByGroup(groupId)
createExercise({ id: tempId, name, order, groupId })
updateExerciseOrder(id, groupId, order)
deleteExercise(id)       → also deletes child entries in a transaction

// ── Entries ──
getEntriesByExercise(exerciseId)  → sorted by date desc
createEntry({ id: tempId, date, weight, reps, note, exerciseId })
deleteEntry(id)
```

All create/update/delete operations also write into `syncQueue`.

---

## 9. The Sync Queue (`sync/queue.js`)

### Data flow

```
User mutates
    │
    ▼
IndexedDB updated (optimistic) ──► UI re-renders instantly
    │
    ▼
syncQueue row written ("create entry", payload, timestamp)
    │
    ▼
processQueue() fires asynchronously
    │
    ├─► API call succeeds → remove row from syncQueue
    │                         update tempId → real serverId in entities table
    │
    └─► API call fails   → increment retries, keep row
                            schedule retry (exponential backoff)
```

### Processing strategy

```js
async function processQueue() {
  const pending = await db.syncQueue.orderBy("timestamp").toArray();

  for (const item of pending) {
    try {
      switch (item.entityType) {
        case "group":
          if (item.operation === "create") await api.post("/groups", item.payload);
          if (item.operation === "delete") await api.delete(`/groups/${item.entityId}`);
          break;
        case "exercise":
          // ...same pattern...
          break;
        case "entry":
          // ...same pattern...
          break;
      }
      // On success: map tempId → serverId if needed, then remove from queue
      await db.syncQueue.where("localId").equals(item.localId).delete();
    } catch (err) {
      // 4xx errors (validation, not found) → remove from queue (can't recover)
      // 5xx / network errors → increment retries, exponential backoff
      await db.syncQueue.update(item.localId, {
        retries: item.retries + 1,
        lastError: err.message,
      });
    }
  }
}
```

### When does the queue process?

1. **Immediately after a mutation** — fire-and-forget `processQueue()`.
2. **On app startup** — process any leftover queue items.
3. **On `window.addEventListener("online", ...)`** — retry when connectivity returns.
4. **Periodic retry** — every 30 seconds while items are pending (low priority).

---

## 10. `useExercises.js` — Refactored Hook (same public API)

### What stays the same (consumer-facing)

The hook returns the **exact same shape** as today:

```js
const {
  exercises, groups, loading, error, refresh,
  addExercise, addGroup, addEntry,
  deleteEntry, deleteExercise, deleteGroup,
  moveExercise, reorderGroups, importData,
} = useExercises();
```

No component changes needed.

### What changes internally

| Operation | Before | After |
|---|---|---|
| **Initial load** | `fetch("/api/...")` → `useState` | Read from IndexedDB (`useLiveQuery`) → instant |
| **Refresh** | Re-fetch everything from server | Re-fetch from server → overwrite IndexedDB → reactively updates UI |
| **Add** | `POST` → `refresh()` (wait for server) | Write to IndexedDB → UI updates → enqueue sync → processQueue() |
| **Delete** | `DELETE` → `refresh()` (wait for server) | Delete from IndexedDB → UI updates → enqueue sync → processQueue() |
| **Reorder** | `PUT` → `refresh()` (wait for server) | Update order in IndexedDB → UI updates → enqueue sync → processQueue() |

### Reactivity via `useLiveQuery`

```js
import { useLiveQuery } from "dexie-react-hooks";

export function useExercises() {
  // These auto-update whenever the IndexedDB tables change.
  const exercises = useLiveQuery(() => getAllExercises(), []);
  const groups     = useLiveQuery(() => getAllGroups(),     []);
  const loading    = exercises === undefined || groups === undefined; // undefined = still loading

  // Mutations write to IndexedDB; useLiveQuery picks up the change instantly.
  const addEntry = async (exerciseId, date, weight, reps, note) => {
    const tempId = `temp_${Date.now()}`;
    await createEntry({ id: tempId, date, weight, reps, note, exerciseId });
    // ↑ useLiveQuery re-renders the component immediately
    processQueue(); // fire-and-forget background sync
  };

  // ...
}
```

---

## 11. ID Mapping (tempId → serverId)

When the user creates something offline, we use a `temp_` prefix ID.  
When the sync succeeds, the server returns the real UUID. We must **replace all references**.

```
┌─────────────────────────────────────────────────────┐
│  Local                                         Sync │
│                                                     │
│  createExercise({ id: "temp_123", name: "Squat" })  │
│       │                                             │
│       ▼                                             │
│  exercises table:                                   │
│    { id: "temp_123", name: "Squat", ... }           │
│       │                                             │
│       ▼                                             │
│  syncQueue:                                         │
│    { entityType: "exercise", entityId: "temp_123",  │
│      operation: "create", ... }                     │
│       │                                             │
│       ▼                      ──────────────────────►│
│  processQueue() ────────────► POST /api/exercises  │
│       │                         response:            │
│       │                         { id: "abc-def-...", │
│       │                           name: "Squat" }   │
│       ◄────────────────────────                     │
│       │                                             │
│       ▼                                             │
│  Update IndexedDB:                                  │
│    1. exercises: temp_123 → abc-def-...             │
│    2. entries with exerciseId=temp_123 → abc-def    │
│    3. Delete syncQueue row                          │
└─────────────────────────────────────────────────────┘
```

---

## 12. Conflict Resolution (initial strategy: "Server Wins")

Since this is a single-user app (per account), conflicts are rare.  
The simplest approach:

- On `refresh()`: server data overwrites local data for all synced items.
- Unsynced items (those still in syncQueue) are **preserved** and re-applied on top of server data after refresh.
- The `_synced` flag or presence in syncQueue determines what survives.

Later, you could upgrade to:
- **Last-write-wins** (compare timestamps).
- **Merge** (server keeps the superset).

---

## 13. `useSyncStatus.js` — Health + Sync UI Feedback

```js
// Exposes sync & health state so the UI can show rich status indicators.

const { pendingCount, isOnline, backendStatus, canSync, lastSyncedAt, forceSync } = useSyncStatus();
// pendingCount:    number of items still in syncQueue (0 = fully synced)
// isOnline:        navigator.onLine (device-level)
// backendStatus:   "up" | "down" | "db-down" | "offline" | "unknown"
// canSync:         backendStatus === "up" (convenience flag)
// lastSyncedAt:    timestamp of last successful sync
// forceSync:       manually trigger processQueue()
```

### Combined status indicators

```
🟢 Synced                     — canSync && pendingCount === 0
🟡 3 pending                  — canSync && pendingCount > 0
🟠 DB down, 5 queued          — backendStatus === "db-down" && pendingCount > 0
🔴 Backend unreachable        — backendStatus === "down" || backendStatus === "offline"
⚪ Unknown (initial)           — backendStatus === "unknown"
```

---

## 14. Migration Path (order of implementation)

| Step | What | Risk |
|---|---|---|
| **1. Backend: add `GET /api/health`** | HealthController (public, no auth) | None |
| **2. Backend: add entries pagination** | `entriesLimit` param + `GET /api/exercises/{id}/entries` | Low — additive |
| **3. Install Dexie** | `npm install dexie dexie-react-hooks` | None |
| **4. Create `src/db/dexie.js`** | Schema + DB instance | None |
| **5. Create `src/db/repositories.js`** | Pure IndexedDB CRUD (with entries-limit loading) | None |
| **6. Create `src/sync/queue.js`** | Sync queue + processQueue (health-aware) | None |
| **7. Refactor `useExercises.js`** | Swap `useState` + `fetch` for `useLiveQuery` + repositories | Medium — same public API + `loadMoreEntries` |
| **8. Add `useSyncStatus.js`** | Health polling + sync indicator | None |
| **9. Test** | Offline mode, reconnects, health states, pagination | Important |
| **10. Remove old `api/client.js`** | No longer needed in hook (sync module still uses it) | Low |

Each step is independently testable. The app works the same after step 5 — just faster and offline-capable.

---

## 15. API Surface Summary (backend changes)

### Existing endpoints — unchanged

| Endpoint | Used by |
|---|---|
| `POST /api/groups` | sync: create group |
| `DELETE /api/groups/:id` | sync: delete group |
| `PUT /api/groups/reorder` | sync: reorder groups |
| `POST /api/exercises` | sync: create exercise |
| `DELETE /api/exercises/:id` | sync: delete exercise |
| `PUT /api/exercises/reorder` | sync: move/reorder exercise |
| `POST /api/entries` | sync: create entry |
| `DELETE /api/entries/:id` | sync: delete entry |

### Existing endpoints — modified (new optional param)

| Endpoint | Change |
|---|---|
| `GET /api/groups/all` | Add `?entriesLimit=N` — caps entries per exercise (most recent N). Default: unlimited. |
| `GET /api/exercises/ungrouped` | Add `?entriesLimit=N` — same behavior. |

### New endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | **Public (no auth)**. Returns `{ status, db, timestamp }`. Used by health polling. |
| `GET /api/exercises/{id}/entries?offset=0&limit=50` | Paginated entry loading for detail view. Returns `{ exerciseId, entries, totalCount, offset, limit }`. |

---

## 16. Edge Cases & Questions to Decide

| Question | Recommendation |
|---|---|
| What if the server returns a 409 Conflict? | For now, server wins on `refresh()`. Unsynced local changes survive (they're in syncQueue). |
| What if the user clears browser data? | Same as today — they'd lose data. Export/import still works as manual backup. |
| Should we sync on tab hidden? | Not needed. Process on mutation + on reconnect. |
| What about the `importData` function? | It already creates items one-by-one via API. With local-first, it writes to IndexedDB first, then queues all sync items. Same pattern, just faster. |
| What about settings (`useSettings.js`)? | Keep as-is — `localStorage` is fine for tiny UI prefs. No change needed. |
| What if the healthcheck endpoint itself is slow? | Use a short timeout (3 seconds). If it times out, treat as "down". Don't block the UI waiting. |
| What if entries are added while "show all" is open? | New entries created locally appear instantly (IndexedDB is reactive). New entries from sync also appear. The `totalCount` is a snapshot — a refresh re-fetches accurate count. |
| What about the entriesLimit default? | 10 per exercise is a sensible default. Could be made configurable via `useSettings` later. |
| Does the sync queue also create entries with `entriesLimit`? | The sync queue only pushes mutations (create/update/delete), it doesn't do reads. The `entriesLimit` only affects the initial data load and `refresh()`.

---

## 17. Bundle Impact

| Addition | Approximate size |
|---|---|
| `dexie` | ~18 KB gzipped |
| `dexie-react-hooks` | ~1 KB gzipped |
| New files (db/, sync/) | ~3-5 KB total |

Total: ~22-24 KB gzipped added. Negligible for a PWA.
