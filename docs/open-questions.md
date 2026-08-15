# Local-First Sync Engine — Open Questions & Gaps

Stand: 2026-08-12. Grundlage: `README.md` (Spec) vs. aktueller Code (`src/`, `backend/`) sowie `docs/local-first-architecture.md`.

## Current state (baseline)

**Frontend** — komplett server-first, keine lokale Datenhaltung:
- `src/hooks/useExercises.js`: lädt alles vom Backend beim Mount, jede Mutation ist `api.post(...)` → `refresh()`. Kein IndexedDB, keine Queue.
- `src/hooks/useSyncStatus.js`: reiner Health-Check-Poll, hardcoded `pendingCount: 0`.
- `src/hooks/useSettings.js`: `localStorage` (bleibt unverändert, Settings sind out of scope).
- `src/auth/AuthContext.jsx`: Session-Cookie-Auth (`login`/`register`/`logout`/`claim`), keine Sync-Anbindung.
- **Dexie ist nicht installiert** (`package.json` enthält kein `dexie`/`dexie-react-hooks`).

**Backend** — Spring Boot 4.1.0, JPA + PostgreSQL mit Row-Level-Security:
- Entities `Entry`/`Exercise`/`Group`/`User` nutzen **servergenerierte** UUIDs (`GenerationType.UUID`).
- `RlsAspect` setzt `app.current_user_id` via `set_config`; RLS-Policies in `V1__init.sql`.
- `GET /api/health`, `GET /api/groups/all?entriesLimit=`, `GET /api/exercises/ungrouped?entriesLimit=` und `GET /api/exercises/{id}/entries?offset&limit` existieren bereits.
- Keine `createdAt`/`updatedAt`-Spalten (nur `Entry.date`).

---

## Gaps vs. Spec (README)

1. **Client-generierte UUIDs (§1.1, §7)** — Backend vergibt IDs serverseitig. Spec verlangt Client-UUID als Idempotency-Key + Unique-Constraint gegen Duplikate bei Retries.
2. **Keine `db/`- oder `sync/`-Schicht** — `src/db/` (Dexie-Schema) und `src/sync/` (Queue) fehlen komplett.
3. **Anonymous-First** — `useExercises.refresh()` macht `if (!authenticated) return` und leert den State beim Logout. Spec: App muss ohne Login voll funktionieren.
4. **Pull nur bei Login** — aktuell Pull bei jedem Mount/Refresh; Spec: Pull ausschließlich beim Login (Push → Pull).
5. **Logout-Flow (§3.3)** — `AuthContext.logout()` ist nur `POST /auth/logout` + State-Clear. Kein letzter Sync-Versuch, keine Queue-Prüfung, kein Dialog, kein Cache+Queue-Clear.
6. **Register nach anonymer Nutzung (§3.4)** — `register()` kennt keine Queue.
7. **Queue-Schema unterspezifiziert** — Eintrag hat `entityUuid` + `op` + `payload`, aber **kein `entityType`**. Ohne Discriminator lässt sich die Queue nicht verarbeiten (Group/Exercise/Entry → unterschiedliche Endpoints/Payloads).
8. **Timestamps** — Spec verlangt clientgesetzte `createdAt`/`updatedAt`; weder Backend noch Cache-Modell haben sie.
9. **Reorder/Move als Ops** — Op-Modell ist `create|update|delete`, aber es gibt `moveExercise` und `reorderGroups` (bulk `PUT .../reorder` mit Shift-Queries).
10. **Cap-Mechanismus (§6)** — braucht einen Weg, `synced`-Einträge (evictable) von `pending`/`failed` (nie evictable) zu unterscheiden → Cache↔Queue-Join nötig.

---

## Open questions

### Q1 — Client-UUID-Storage
Client-UUID als Entity-PK verwenden oder Server-PK + separate Unique-Spalte `client_uuid`?
Spec sagt "Unique-Constraint auf dieser Client-UUID" (impliziert separate Spalte), aber PK-Variante wäre einfacher.

### Q2 — Retry-Idempotenz-Contract
Was passiert beim replizierten `create` mit bereits bekannter Client-UUID?
- Bestehende Entity zurückgeben (idempotent, 200/201), oder
- 409 Conflict?
Die Ack-Logik (`ack → synced`) hängt davon ab.

### Q3 — `entityType` im Queue-Schema
Bestätigen, dass der Queue-Eintrag ein `entityType: 'group' | 'exercise' | 'entry'` bekommt (README lässt es weg).

### Q4 — Reorder-Repräsentation offline
Wie werden `moveExercise` / `reorderGroups` als Queue-Ops abgebildet?
- Einzelne `update`-Ops mit vollem Payload (`order`, `groupId`), oder
- neue Op-Typen?
Der Bulk-Reorder-Endpoint macht das offline nicht-trivial.

### Q5 — `deleteExercise`-Kaskade
Das Löschen einer Exercise muss auch ihre Entries löschen. Ein Queue-Op (Server kaskadiert) oder mehrere Ops? Backend: `Exercise` hat `orphanRemoval`, aber `Entry` hat keine Kaskade von seiner Seite — aktuelles Delete-Verhalten prüfen.

### Q6 — Altes Doc vs. neue Spec
`docs/local-first-architecture.md` widerspricht dem README an mehreren Stellen:
- temp-IDs + tempId→serverId-Mapping vs. Client-UUIDs
- 30s-Periodic-Retry + `navigator.onLine`-Check vs. ein Versuch pro Trigger, kein Polling, kein onLine-Check
- Server-Wins-`refresh()` vs. Pull-only-on-login

Welches Dokument gilt? (Annahme: README ersetzt das alte Doc — bestätigen und altes Doc löschen/annotieren.)

### Q7 — Migration/Claim-Flow
Der bestehende `migrate → claim → login`-Flow muss wie ein normales Login Push→Pull auslösen. Werden anonyme lokale Daten in einen geclaimten Migrations-Account gemergt oder getrennt gehalten?

### Q8 — Umgang mit `failed`-Einträgen
`failed`-Einträge werden weder retried noch vom Cap evictet — sie bleiben für immer. Gibt es eine UI-Aktion zum Verwerfen/Neuversuchen? (Spec §4 nennt nur "dezenter Hinweis", keine Recovery-Aktion.)

### Q9 — Test-Scope (§8)
Aktuelle Tests sind server-first-Mocks (`useExercises.test.jsx`). Welche der 12 Kernszenarien sind für den ersten Milestone Pflicht, welche später?

### Q10 — `importData`
Aktuell legt `importData` Einträge einzeln per API an. Local-First: erst in IndexedDB schreiben + alle Sync-Ops queue'en — gleiche Struktur, nur schneller. Bestätigen?

---

## Entscheidungen (Stand 2026-08-12)

- **Q1 Client-UUID als PK**: Client-UUID direkt als PK verwenden, keine separate `client_uuid`-Spalte. PK erzwingt die Eindeutigkeit automatisch.
- **Q2 Retry-Idempotenz**: Idempotent — 200/201 mit bestehender Entity, kein 409. Retry nach Timeout ist Normalfall, kein echter Konflikt.
- **Q3 `entityType`**: Ja, `entityType: 'group' | 'exercise' | 'entry'` in jeden Queue-Eintrag.
- **Q4 Reorder offline**: `update`-Op mit vollem neuen Zustand (`order`, `groupId`). Kein neuer Op-Typ. Bulk-Endpoint bleibt für Online-Nutzung bestehen.
- **Q5 Delete-Kaskade**: Server kaskadiert; Queue enthält nur einen `delete`-Op für die Exercise. Backend-Kaskade ggf. korrigieren.
- **Q6 Altes Doc**: README ersetzt `docs/local-first-architecture.md` vollständig. Altes Doc löschen oder als veraltet markieren.
- **Q7 Migration/Claim**: wie §3.4 behandeln — Queue dem geclaimten Account zuordnen, dann Push → Pull. Kein separates Merge-Konzept.
- **Q8 `failed`-Einträge**: kein Recovery-UI im ersten Milestone, nur dezenter Hinweis. Retry-Button als spätere Erweiterung.
- **Q9 Test-Priorität**: Szenarien 2, 3, 4, 8/8b, 10 zuerst. Reorder-/Kaskade-Tests nach Q4/Q5.
- **Q10 `importData`**: bestätigt — erst lokal in den Cache schreiben, dann pro Eintrag ein Queue-Op (seriell verarbeitet).
- **F1 Delete-Idempotenz**: Ja — 204 (No-op) statt 404 bei nicht gefundener Entity (`EntryService`, `ExerciseService`, `GroupService`).
- **F2 Update-Endpunkte**: Ja — `PUT /groups/{id}`, `PUT /exercises/{id}`, `PUT /entries/{id}` mit vollem Payload-Ersatz (kein Patch/Diffing). `update` gilt auch für Entries.
- **F3 Timestamps**: alle drei Entities (`entry`, `exercise`, `group`) bekommen `createdAt`/`updatedAt`; Client-Timestamps 1:1, kein Server-Override.
- **F4 Cap**: evictable, wenn es **keinen einzigen** Op mit Status `pending`/`syncing`/`failed` für die `entityUuid` gibt (Join/Lookup über `entityUuid`, kein "letzter Op"-Tracking).
- **F5 Auth ↔ Engine**: expliziter Trigger aus dem Auth-Context (Login/Logout/Register → `processQueue()` bzw. Push→Pull); kein eigenständiger Session-Poll in der Engine.
- **F6 Migrations-Pfad**: ebenfalls Client-UUIDs; Migration verhält sich wie Register-nach-anonym (Queue-Push). Alter servergenerierter Import-Pfad entfällt.

---

## Weitere offene Fragen (Follow-up)

### F1 — Delete-Idempotenz (Gegenstück zu Q2)
Q2 klärt nur `create`. Auch `update`/`delete` können durch Retries doppelt ankommen. Aktuell werfen `EntryService.delete` / `ExerciseService.delete` / `GroupService.delete` bei nicht gefundener Entity `EntityNotFoundException` (404 → Server-Fehler → nach Max-Retry `failed`). Sollen Delete-Endpunkte idempotent sein (No-op, 204 bei fehlender Entity)?

### F2 — Update-Endpunkte fehlen (Gegenstück zu Q4)
`update`-Ops brauchen Einzel-Endpunkte, die es nicht gibt: aktuell nur Bulk-`PUT /groups/reorder` und `PUT /exercises/reorder`. Werden `PUT /groups/{id}` und `PUT /exercises/{id}` ergänzt? Welche Update-Semantik (voller Payload-Ersatz)? Gilt `update` auch für Entries — die App kann Entries aktuell nur anlegen/löschen, nicht editieren?

### F3 — Timestamps (Gaps #8)
Spec: `createdAt`/`updatedAt` vom Client, kein Server-Override. Backend hat keine solchen Spalten. Welche Entities brauchen sie (nur `entry`, oder auch `exercise`/`group`), und übernehmen die create/update-Endpunkte Client-Timestamps 1:1?

### F4 — Cap: "synced"-Bestimmung
Queue ist append-only ohne Kompaktierung, mehrere Ops pro `entityUuid` erlaubt. Wann gilt ein Cache-Eintrag als cap-evictable? Vorschlag: kein `pending`/`syncing`/`failed`-Op für diese `entityUuid` (bzw. letzter Op `synced`). Bestätigen?

### F5 — Auth-Zustand ↔ Sync-Engine
Ohne Login kein Push; der Auth-Zustand lebt im React-Context, die Sync-Engine liegt außerhalb. Wie erfährt die Engine den Zustand — expliziter Trigger aus dem Auth-Context (Login → `processQueue()`), oder eigenständiger Session-Check?

### F6 — Migrations-Pfad
`MigrationService.migrate` persistiert aktuell mit servergenerierten IDs (separater Import-Pfad, nicht Local-First). Bleibt das so, oder wird der Migrations-Pfad ebenfalls auf Client-UUIDs umgestellt?

---

## Weitere offene Fragen (2. Runde)

### G1 — Max-Retry-Wert & Config-Bereinigung
Spec §4 nennt "z.B. 100 Versuche", `src/config.defaults.js` hat `sync.maxRetries: 10`. Welcher Wert gilt? Und: `baseDelayMs`/`maxDelayMs`/`retryIntervalMs` stammen aus dem alten Backoff-/Polling-Ansatz — entfallen die, da es laut Spec kein geplantes Retry-Polling gibt?

### G2 — App-Start mit wiederhergestellter Session
§2 nennt "App-Start, wenn eingeloggt" als Trigger; §5 sagt Pull nur "im Rahmen von Login". Zählt ein App-Start mit bestehender Session (via `/auth/me` wiederhergestellt) als Login → Push+Pull, oder nur Push?

### G3 — `refresh()`-Semantik
Die Hook-API exportiert `refresh()` (und Tests hängen daran). Was soll `refresh()` im Local-First-Modus tun? Optionen: (a) nur lokales Neu-Lesen aus IndexedDB, (b) manueller Pull (widerspricht "Pull nur bei Login"), (c) entfernen. Und `loadMoreEntries` bleibt unverändert?

### G4 — Health-Polling & `pendingCount`
`useSyncStatus` pollt `/api/health` alle 30s und hardcodet `pendingCount: 0`. Health-Polling bleibt (betrifft nicht die Sync-Trigger), und `pendingCount` kommt künftig aus der Queue? Bestätigen.

### G5 — Legacy-Migrations-Flow vs. F6
Der bestehende `/api/migrate` + `/api/migrate/claim` + `ClaimDialog` ist die Migration vom **alten Pure-JSON-Stand** (`docs_ref/migration-plan.md`), nicht der Local-First-Queue-Push. F6 ("alter Import-Pfad entfällt") bezieht sich nur auf die Server-ID-Vergabe im `MigrationService` — oder soll der komplette Legacy-Migrations-Flow entfernt werden?

---

## Suggested implementation order

1. `dexie` + `dexie-react-hooks` installieren; `src/db/`-Schema erstellen (Q3 vorher klären).
2. Backend: Client-UUID-Idempotenz + `createdAt`/`updatedAt`-Spalten (Flyway `V5`).
3. `src/sync/queue.js` (seriell, pro-Eintrag unabhängige Fehlerbehandlung, max-retry → `failed`).
4. `useExercises.js` auf Local-First + `useLiveQuery` refactoren (öffentliche API beibehalten).
5. Auth anbinden (Login Push→Pull, Register assoziiert Queue, Logout Final-Sync→Dialog→Clear).
6. Cap-Mechanismus + Tests für die §8-Szenarien.
