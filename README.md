# Local-First Sync Engine — Spec

## Kontext

Gym-App mit Gruppenübungen und Sets/Entries. Aktuell: Spring Backend mit Login/Session, alles serverseitig. Vorher: reines JSON im Browser (kein Load-Delay beim Öffnen). Ziel: Local-First mit IndexedDB (Dexie) als primärem Datenspeicher + Sync-Engine im Hintergrund, ohne den Instant-Open-Charakter zu verlieren.

**Kernprinzip:** Die App funktioniert immer ohne Login. Daten werden sofort in die IndexedDB geschrieben und unabhängig davon synchronisiert, wenn ein Account vorhanden/eingeloggt ist.

### Begriffsklärung
- **"Cache"** bezeichnet in dieser Spec durchgehend die **IndexedDB/Dexie-Datenbank** als primären lokalen Datenspeicher (der eigentliche Entity-Datenbestand, z.B. Übungs-Entries).
- **"Queue"** bezeichnet den separaten Dexie **Object Store** für die Sync-Queue (Op-Log der noch zu synchronisierenden Operationen). Queue liegt technisch in derselben Dexie-DB wie der Cache, ist aber ein eigener Store mit eigenem Lifecycle (siehe Abschnitt 3.3 — bei Logout werden z.B. beide, aber nicht immer gleich behandelt).

---

## 1. Datenmodell

### 1.1 Lokale Entities (IndexedDB / Dexie)
- Jede Entity (z.B. ein Übungs-Entry/Set) bekommt eine **client-generierte UUID** beim Anlegen — nie eine serverseitig vergebene ID.
- Zeitstempel (`createdAt`/`updatedAt`) kommen **immer vom Client/User-Gerät**. Kein Server-Timestamp-Override. Sie sind primär für den Sync-Layer relevant (Debugging, generisches Zeitfeld über alle Entities).
- **Sortier-/Cap-Schlüssel für `Entry` ist `date` (Trainingsdatum), nicht `createdAt`.** `date` ist ein fachliches Feld (wann wurde trainiert) und unterscheidet sich bewusst von `createdAt` (wann wurde der Datensatz technisch angelegt) — relevant bei nachgetragenen Workouts (z.B. Training von gestern, heute erfasst: `date` = gestern, `createdAt` = heute). "Letzte N Einträge" meint fachlich *letzte N trainierte Tage*, nicht *letzte N App-Interaktionen*. Gilt für: Backend-Sortierung, Pull-Cap (`entriesLimit`), lokale Cap-Eviction (Abschnitt 6). Für `Exercise`/`Group` (keine eigene Domänen-Zeitangabe) bleibt `createdAt`/`updatedAt` der relevante Zeitstempel, sofern zeitliche Sortierung dort überhaupt gebraucht wird.
- Cache-Store enthält nur Entities mit Status `synced` oder `pending`/`failed` (letztere referenziert über die Queue, siehe unten) — der Cache selbst hat kein eigenes komplexes Statusfeld nötig, der Status lebt primär in der Queue.

### 1.2 Sync-Queue (separater Dexie Object Store, append-only)
Eigener Object Store in derselben Dexie-DB (nicht `localStorage` — Limit/Blocking-Probleme).

Jeder Queue-Eintrag = **eine Operation** (Trace/Op-Log), nicht nur "Entity ist dirty":

```
{
  id: auto-increment (Queue-interne Reihenfolge),
  entityUuid: string,
  op: 'create' | 'update' | 'delete',
  payload: {...} | null,   // null bei delete
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  retryCount: number,
  createdAt: timestamp
}
```

- Mehrere Ops zur selben `entityUuid` sind erlaubt und bleiben alle in der Queue (kein Kompaktieren/Zusammenfassen — bewusst weggelassen, Datenmenge ist gering genug).
- Nach erfolgreichem Ack vom Backend wird der Queue-Eintrag **sofort entfernt** (nicht auf `synced` gesetzt und behalten). Die Queue enthält damit ausschließlich offene Ops (`pending`/`syncing`/`failed`). Entscheidung nach User-Feedback — ersetzt das ursprüngliche „kein Kompaktieren“.
- Queue bleibt bei jedem Vorgang **unberührt**, außer bei aktivem Logout (siehe 3.3).

---

## 2. Sync-Trigger

- **Bei jedem Hinzufügen einer Entity** (neuer Queue-Eintrag) wird sofort ein Sync-Versuch für die Queue angestoßen.
- **Bei jedem App-Start mit aktiver/wiederhergestellter Session** (auch via Session-Restore, z.B. `/auth/me`, nicht nur bei explizitem Login-Klick) — zählt als vollständiger Login-Vorgang, siehe 3.2 (Push **und** Pull, nicht nur Push).
- Kein `navigator.onLine`-Check vorab (unzuverlässig) — einfach Request versuchen, Timeout/Fehler regulär abfangen.
- Kein Loop/kontinuierliches Retry-Polling. Ein Versuch pro Trigger.

---

## 3. Zustände & Übergänge

### 3.1 Standardfall: anonym → Nutzung
- Ohne Login werden Entities normal in IndexedDB geschrieben.
- Queue-Einträge werden erzeugt, aber Sync-Versuch schlägt naturgemäß fehl (kein Server-Kontext) bzw. wird gar nicht erst probiert, solange keine Session existiert — bleibt `pending`.

### 3.2 Login (bestehender Account, im Hintergrund oder aktiv)
"Login" meint hier jeden Übergang in einen aktiv authentifizierten Zustand — ob durch expliziten Login-Klick oder durch Session-Restore beim App-Start (z.B. via `/auth/me`). Beide Fälle lösen denselben Ablauf aus, kein Unterschied in der Behandlung.

Reihenfolge ist strikt:
1. **Erst Push:** komplette Sync-Queue wird abgearbeitet (siehe Abschnitt 4).
2. **Danach Pull:** paginiertes Nachladen vom Server (z.B. letzte N Einträge pro Übung), asynchron, blockiert UI nicht.

Diese Reihenfolge (Push vor Pull) verhindert strukturell, dass gelöschte/geänderte lokale Daten durch einen Pull "wiederauferstehen" — kein zusätzlicher Reconciliation-Schritt nötig.

Ausnahme: Schlägt ein einzelner Push-Eintrag fehl (Timeout → `failed` nach Max-Retry), zeigt der nachfolgende Pull für genau diese eine Entity den alten Serverstand. Das ist korrekt, kein Bug.

### 3.3 Aktiver Logout
Ablauf, in dieser Reihenfolge:
1. **Letzter Sync-Versuch:** Bei Logout-Klick wird zunächst noch einmal versucht, die komplette Queue zu pushen (kurz, mit Timeout, z.B. 2–3s). Grund: ein Eintrag kann rein aus Timing-Gründen `pending` sein (z.B. gerade erst erstellt, Sync-Trigger noch nicht durchgelaufen) — das ist kein Bug und soll nicht unnötig einen Warn-Dialog auslösen.
2. **Queue erneut prüfen.** Sind danach noch Einträge `pending`/`failed`, ist das ein echter Fehlerfall (nicht mehr Timing) — Grund: ist ein Logout-Request möglich, ist der Client online; alles was dann immer noch nicht durchkam, deutet auf ein tatsächliches Problem hin (Server-Fehler, Bug), nicht auf fehlende Konnektivität.
3. **Nur falls noch Einträge übrig sind:** Bestätigungs-Dialog "X Einträge nicht synchronisiert, trotzdem ausloggen?".
   - Bestätigt der Nutzer → weiter mit Schritt 4.
   - Bricht der Nutzer ab → Logout wird nicht durchgeführt, User bleibt eingeloggt, Queue bleibt unverändert (kann später erneut synct/logged out werden).
4. **Clear:** IndexedDB-**Cache** und Sync-**Queue** werden beide vollständig gecleared (anders als ursprünglich angenommen — nicht nur der Cache. Alles was nach dem letzten Sync-Versuch + Bestätigung noch nicht synced war, gilt als bewusst verworfen).
- Ist die Queue nach Schritt 1 bereits leer/vollständig synced, entfällt der Dialog, Logout läuft direkt mit Schritt 4 durch.
- Bei nächstem Login (gleicher oder anderer Account) ist die Queue also in jedem Fall leer — es wird direkt mit Pull begonnen (kein Push mehr nötig aus einer vorherigen Session).

### 3.4 Register nach anonymer Nutzung (Sonderfall 1)
- Neuer User-Account wird angelegt.
- Bestehende Queue (alle offline gesammelten Ops) wird diesem neuen Account zugeordnet und regulär durchgepusht (wie 3.2, Schritt 1).
- Kein Pull nötig danach im eigentlichen Sinn (neuer Account hat ohnehin nur das, was gerade gepusht wurde), aber schadet nicht, denselben Ablauf wie 3.2 zu verwenden (Push → Pull).

### 3.5 Login-Wechsel (bestehender Account, Standardfall laut Klärung)
- Kein Gerät-Sharing-Szenario zu berücksichtigen — ein Gerät, ein Nutzer im Gym vor Ort. Kein Merge-Prompt nötig.

---

## 4. Queue-Verarbeitung (Push)

- **Seriell, ein Request nach dem anderen** — nicht parallel. Das garantiert automatisch korrekte Reihenfolge pro Entity (z.B. `create` vor `update` vor `delete` derselben UUID), ohne dass explizite Pro-Entity-Locks nötig sind.
- **Unabhängige Fehlerbehandlung pro Eintrag:** Schlägt Eintrag 1 fehl, werden Eintrag 2, 3, ... trotzdem versucht. Kein Abbruch der gesamten Queue bei einem einzelnen Fehler.
- **Fehlerklassifizierung:**
  - **Netzwerkfehler/Timeout** → regulärer, erwarteter Fall. Bleibt `pending`, `retryCount++`, nächster Versuch beim nächsten Trigger (neue Entity oder App-Start).
  - **Server-Fehler (4xx)** → gilt als Bug/permanenter Fehler, nicht automatisch heilbar durch Retry. Wird trotzdem über denselben `retryCount`-Mechanismus behandelt (siehe Max-Retry).
- **Max-Retry-Limit:** z.B. 100 Versuche. Danach Status `failed`, kein weiterer automatischer Versuch. Dezenter Hinweis in der UI (kein Monitoring/Grafana o.ä. — bewusst außen vor gelassen).
- **Ack-basiert:** Ein Eintrag wird erst nach explizitem Ack vom Backend auf `synced` gesetzt, nie optimistisch vorher.

---

## 5. Pull (nur bei aktivem/Hintergrund-Login)

- Passiert **ausschließlich** im Rahmen von Login (3.2), niemals sonst (kein periodisches Pull-Polling während normaler Nutzung — sonst wird ständig gesynct und wieder gelöscht/überschrieben).
- **Paginiert / gecapped:** nicht die komplette Historie laden, sondern z.B. die letzten N Einträge pro Übung — analog zum lokalen Cap (Abschnitt 6). Verhindert, dass bei langjährigen Nutzern ein Mega-Load beim Login passiert.
- Läuft asynchron im Hintergrund, blockiert nicht die UI.

---

## 6. Cache-Cap ("max. 10 Einträge pro Übung")

- Bei jedem App-Start wird geprüft, wie viele Einträge pro Übung lokal gecacht sind.
- Bei Überschreitung: älteste Einträge werden entfernt — **aber ausschließlich solche mit Status `synced`**.
- Einträge, die noch in der Sync-Queue hängen (`pending`/`failed`, also noch nicht vom Server bestätigt), werden **niemals** durch den Cap-Mechanismus gelöscht, unabhängig vom Alter.
- Der Cap betrifft nur den Cache/die Anzeige-Daten, nicht die Queue.

---

## 7. Technische Eckpunkte

- **Storage:** Dexie.js (IndexedDB-Wrapper), ein separater Object Store für die Queue innerhalb derselben DB.
- **IDs:** Client-generierte UUIDs für alle offline erzeugten Entities, als stabiler Idempotency-Key. Backend braucht einen Unique-Constraint auf dieser Client-UUID, damit Retries keine Duplikate erzeugen.
- **Schema-Migrationen:** über Dexies eigenes Versionierungssystem (`db.version(n).stores({...}).upgrade(tx => {...})`), kein SQL. Bestehende User-Daten bleiben bei App-Updates erhalten, sofern Upgrade-Funktionen sauber definiert sind.
- **Synced-Ops werden gelöscht:** Erfolgreich bestätigte Ops werden sofort aus der Queue entfernt. Offene Ops derselben UUID bleiben dagegen unkompaktiert erhalten (create/update/delete-Reihenfolge bleibt als Trace), bis sie acked sind.
- **Kein Multi-Tab-Schutz (`navigator.locks`/`BroadcastChannel`):** bewusst weggelassen, da PWA im Gym-Kontext praktisch immer nur ein aktiver Tab/eine Instanz hat.
- **Kein Online-Check vor Sync-Versuch:** `navigator.onLine` ist unzuverlässig, einfach Request versuchen und Fehler/Timeout regulär behandeln.
- **Kein Monitoring/Grafana:** Fehlerzustände (`failed` nach Max-Retry) werden nur lokal sichtbar gemacht (dezenter UI-Hinweis), kein externes Observability-Tooling.
- **Tests:** sollten die Kernübergänge abdecken (siehe Abschnitt 8).

---

## 8. Zu testende Kernszenarien

1. Anonym: Entity anlegen → landet in Cache + Queue, kein Sync-Versuch schlägt hart fehl (nur `pending`).
2. Login (bestehender Account) mit gefüllter Queue: Push läuft komplett vor Pull.
3. Push-Reihenfolge: `create` → `update` → `delete` derselben UUID werden seriell und in korrekter Reihenfolge verarbeitet, auch wenn `create` initial fehlschlägt und retried wird.
4. Netzwerkfehler bei Push: Eintrag bleibt `pending`, wird beim nächsten Trigger erneut versucht, Queue-Verarbeitung bricht nicht komplett ab.
5. Server-Fehler (4xx) bei Push: nach Max-Retry → Status `failed`, kein weiterer Auto-Versuch, UI-Hinweis erscheint.
6. Ein fehlerhafter Eintrag blockiert nicht die Verarbeitung nachfolgender Queue-Einträge.
7. Register nach anonymer Nutzung: neuer Account bekommt vorhandene Queue zugeordnet und published sie.
8. Aktiver Logout (Queue bereits vollständig synced): kein Dialog, Cache und Queue werden direkt geleert.
8b. Aktiver Logout mit `pending`/`failed`-Resteinträgen nach letztem Sync-Versuch: Warn-Dialog erscheint; bei Abbruch bleibt User eingeloggt und Queue unverändert; bei Bestätigung werden Cache und Queue beide vollständig gecleared.
9. Erneuter Login nach Logout: Queue ist leer, es wird direkt mit Pull begonnen (kein Push-Schritt mehr nötig).
10. Cap-Mechanismus: bei >10 Einträgen pro Übung werden nur `synced`-Einträge entfernt, `pending`/`failed` bleiben unangetastet unabhängig vom Alter.
11. Pull ist paginiert/gecapped, kein Full-History-Load beim Login.
12. Dexie-Schema-Migration: bestehende Daten überleben ein simuliertes Schema-Upgrade.

---

## Offen / bewusst nicht adressiert (Scope-Entscheidungen)

- Kein Gerät-Sharing-Szenario (ein Nutzer pro Gerät angenommen).
- Kein Merge-UI bei Login-Konflikten (da 3.5 nicht relevant).
- Keine Kompaktierung *offener* Ops (synced Ops werden sofort entfernt).
- Kein Multi-Tab-Locking.
- Kein Monitoring/externes Tooling für `failed`-Einträge.

---

## Implementation Decisions (Q/F/G — beantwortet nach Code-Review durch Agent)

Diese Entscheidungen wurden nachträglich getroffen, nachdem der Agent die Spec gegen den bestehenden Code (`src/`, `backend/`) geprüft und offene Fragen/Lücken identifiziert hat. Sie sind bindend und ergänzen/präzisieren die Abschnitte oben.

### Client-UUIDs & Idempotenz
- **Q1 — UUID-Storage:** Client-UUID wird direkt als Entity-**PK** verwendet, keine separate `client_uuid`-Spalte. Der PK erzwingt Eindeutigkeit automatisch.
- **Q2 — Create-Idempotenz:** Ein `create` mit bereits bekannter Client-UUID ist idempotent → bestehende Entity wird zurückgegeben (200/201), **kein 409**. Retry nach Timeout ist der Normalfall, kein echter Konflikt.
- **F1 — Delete-Idempotenz:** Analog zu Q2: `delete` einer bereits gelöschten/nicht gefundenen Entity antwortet mit **204 (No-op)**, nicht 404. Gilt für `EntryService`, `ExerciseService`, `GroupService` gleichermaßen. Ein 404 würde die Queue fälschlich in `failed` schieben, obwohl der Zielzustand längst erreicht ist.

### Queue-Schema & Op-Typen
- **Q3 — `entityType`:** Jeder Queue-Eintrag bekommt zusätzlich zu `entityUuid`/`op`/`payload` ein Feld `entityType: 'group' | 'exercise' | 'entry'`. War ein Versäumnis der ursprünglichen Spec.
- **Q4 — Reorder/Move offline:** Wird als normaler `update`-Op mit vollem neuen Zustand (`order`, `groupId`, etc.) abgebildet — **kein neuer Op-Typ**. Der bestehende Bulk-Reorder-Endpoint (`PUT .../reorder`) bleibt für Online-Nutzung bestehen, ist aber nicht Teil des Offline-Op-Modells.
- **F2 — Update-Endpunkte:** `PUT /groups/{id}`, `PUT /exercises/{id}` und `PUT /entries/{id}` werden als Einzel-Endpunkte ergänzt (aktuell existieren nur Bulk-Reorder-Endpunkte). Semantik: **voller Payload-Ersatz**, kein Patch/Partial-Update — konsistent damit, dass jeder Queue-Eintrag den vollständigen neuen Zustand trägt. `update` gilt auch für `entry`, auch falls die UI aktuell kein Entry-Editing anbietet (Zukunftssicherheit; falls Entries bewusst nie editierbar sein sollen, wird der Op-Typ für `entityType: 'entry'` einfach nie erzeugt).
- **Q5 — Delete-Kaskade:** Server kaskadiert (löscht abhängige Entries serverseitig mit). Die Queue enthält für das Löschen einer Exercise nur **einen** `delete`-Op, keine Einzel-Ops für jeden zugehörigen Entry. Backend-Kaskade (`Entry` fehlt aktuell die Kaskade von `Exercise`-Seite) muss entsprechend korrigiert werden.

### Timestamps
- **F3:** **Alle drei Entities** (`entry`, `exercise`, `group`) bekommen `createdAt`/`updatedAt`-Spalten (Flyway-Migration nötig), nicht nur `entry`. Create-/Update-Endpunkte übernehmen die vom Client gesendeten Timestamps **1:1, ohne Server-Override** — konsistent mit Abschnitt 1.1.

### Cap-Mechanismus
- **F4 — Evictable-Kriterium:** Ein Cache-Eintrag ist cap-evictable, wenn es **keinen einzigen** Queue-Eintrag mit Status `pending`/`syncing`/`failed` für seine `entityUuid` gibt — unabhängig davon, ob es sich um den zeitlich letzten Op für diese UUID handelt. Da die Queue nicht kompaktiert wird (mehrere Ops pro UUID möglich), reicht ein einfacher Existenz-Check ("gibt es *irgendeinen* offenen Op zu dieser UUID"), kein Tracking des "letzten" Ops nötig.

### Auth ↔ Sync-Engine Kopplung
- **F5:** Die Sync-Engine wird **explizit vom Auth-Context getriggert** (Login/Register/Logout ruft gezielt `processQueue()` bzw. den Push→Pull-Ablauf auf). Kein eigenständiger Session-Polling-Mechanismus in der Engine selbst — vermeidet doppeltes Triggern/Race-Conditions.
- **G2 — Session-Restore zählt als Login:** App-Start mit wiederhergestellter Session (z.B. via `/auth/me`) löst denselben vollständigen Login-Ablauf aus wie ein expliziter Login-Klick — **Push und Pull**, nicht nur Push. Siehe Korrektur in Abschnitt 2/3.2.

### Migration (alter Pure-JSON-Stand → Account)
- **Q7 / F6 / G5:** Der bestehende `/api/migrate` + `/api/migrate/claim` + `ClaimDialog`-Flow bleibt als eigener, einmaliger Onboarding-Pfad für Alt-Nutzer **bestehen** (kein Teil der laufenden Sync-Engine, sondern Einmal-Import beim Architektur-Wechsel). Intern wird `MigrationService.migrate` jedoch auf denselben **Client-UUID-Persistenzmechanismus** umgestellt wie der reguläre Sync-Push — keine servergenerierten IDs mehr, kein zweites ID-Schema. Der alte servergenerierte Import-Pfad entfällt dadurch, der Flow/die Endpunkte/das Dialog-UI bleiben aber erhalten.
- Der separate `migrate → claim → login`-Flow für **anonyme lokale Daten nach Login-Wechsel** (ursprüngliche Q7-Frage) wird wie Abschnitt 3.4 behandelt: Queue wird dem geclaimten Account zugeordnet, dann Push → Pull.

### Retry-Konfiguration
- **G1:** Verbindlicher Wert ist **`maxRetries: 100`** (aus Abschnitt 4 der Spec) — der bestehende Config-Wert `sync.maxRetries: 10` ist falsch und zu korrigieren. Die Config-Felder `baseDelayMs`, `maxDelayMs`, `retryIntervalMs` (Reste des alten Backoff-/Polling-Ansatzes) **entfallen ersatzlos**, da es kein geplantes Retry-Polling mehr gibt — nur ereignisgetriebene Trigger (neue Entity, App-Start/Login). Ein `failed`/`pending`-Eintrag wartet auf den nächsten organischen Trigger, kein eigener Timer.

### Frontend-Hook-API
- **G3 — `refresh()`:** Bleibt als Funktion bestehen (Stabilität für bestehende Call-Sites/Tests), tut im Local-First-Modus aber nur noch **(a) ein lokales Neu-Lesen aus IndexedDB** — kein Server-Call, kein Pull. Mit `useLiveQuery` (Dexie React Hooks) ist das ohnehin meist automatisch reaktiv; `refresh()` wird dann effektiv zum No-op/Reaktivitäts-Trigger. `loadMoreEntries` bleibt unverändert, solange es sich auf lokal/paginiert vorhandene Cache-Daten bezieht und keinen impliziten Server-Pull auslöst.
- **G4 — Health-Polling & `pendingCount`:** Das bestehende `/api/health`-Polling in `useSyncStatus` bleibt bestehen (reiner Konnektivitäts-Check, kein Sync-Trigger). `pendingCount` wird **nicht mehr hardcoded `0`**, sondern über eine Live-Query auf den Queue-Store berechnet (Anzahl Einträge mit Status `pending`/`syncing`/`failed`) — dieselbe Datenbasis, die auch der Logout-Warn-Dialog (3.3) nutzt.

### Fehlerbehandlung & Recovery
- **Q8:** Kein Recovery-UI (Retry-/Verwerfen-Button) im ersten Milestone — nur der dezente Hinweis wie in Abschnitt 4 beschrieben. Spätere Erweiterung, kein Blocker.

### Sonstiges
- **Q6:** `README.md`/diese Spec ersetzt `docs/local-first-architecture.md` vollständig (widersprüchliche Punkte: temp-IDs, 30s-Polling, Server-Wins-Refresh). Altes Doc löschen oder eindeutig als veraltet markieren.
- **Q9 — Test-Priorität für ersten Milestone:** Testszenarien 2 (Login Push→Pull-Reihenfolge), 3 (Op-Reihenfolge pro Entity), 4 (Netzwerkfehler-Retry ohne Queue-Abbruch), 8/8b (Logout-Flow inkl. Dialog), 10 (Cap-Mechanismus). Reorder-/Kaskade-spezifische Tests folgen nach Umsetzung von Q4/Q5.
- **Q10 — `importData`:** Bestätigt — erst lokal in den Cache schreiben, dann pro Eintrag ein Queue-Op erzeugen (seriell verarbeitet wie jede andere Queue-Operation), keine Sonderbehandlung.

### Pull-Merge-Verhalten (R1)
- **Cache-Einträge mit offenen Queue-Ops (`pending`/`syncing`) für ihre `entityUuid` werden von einem Pull nicht überschrieben oder gelöscht.** Server-Stand gewinnt nur für UUIDs ohne offene Ops.
  - `pending`/`syncing` create/update → lokale Version bleibt, Pull überspringt diese UUID.
  - `pending`/`syncing` delete → Tombstone-Verhalten: Pull darf den Eintrag nicht zurückschreiben, auch wenn der Server ihn noch führt.
  - `failed` → Ausnahme, bleibt wie in §3.2 spezifiziert: zeigt den alten Serverstand (Server gilt als Wahrheit, bis der User/die Queue das Problem löst).
- Praktisch: Pull macht ein Upsert pro Server-Entity, außer es existiert für die `entityUuid` ein `pending`/`syncing`-Op in der Queue — dann wird das Upsert für diese eine UUID übersprungen.

### Legacy-Migrate: Client-UUID-Erzeugung (R2)
- Der Client generiert die Client-UUIDs **vor** dem `POST /api/migrate`, nicht der Server — hält "client-generiert" durchgängig und lässt den Migrate-Request von derselben Idempotenz-Logik profitieren wie reguläre `create`-Ops (Q2): ein Retry des gesamten Migrate-Requests dupliziert nichts.
- Der alte `MigrateRequest` mit den ursprünglichen String-IDs aus dem Pure-JSON-Stand bleibt als Input-Format bestehen (Referenz/Mapping); der Client mappt beim Request-Aufbau jede Alt-Entity auf eine frisch generierte Client-UUID.

### `loadMoreEntries` / "Show all" als Ausnahme von §5 (R3, S2)
- §5 ("Pull nur bei Login") bezieht sich auf den **passiven/automatischen** Sync-Pull. Ein explizites, user-getriggertes Nachladen ("ältere Einträge anzeigen") ist davon ausgenommen: es liefert ausschließlich bereits synced Server-Daten, unabhängig vom Login-Zeitpunkt, und schreibt **nicht** dauerhaft in den gecappten Cache zurück — sonst müsste der Cap-Mechanismus bei jedem "Show all" wieder leergeräumt werden.
- **Rückgabetyp:** `loadMoreEntries` liefert `{ entries, totalCount }` statt nur `totalCount`. Die zurückgegebenen `entries` leben transient im Component-State des Aufrufers (z.B. einer "Show all"-View), nicht in Dexie/im gecappten Cache.

### Sortier-/Cap-Schlüssel bei `Entry` (S1)
- Siehe Abschnitt 1.1: Sortierung und Cap-Eviction für `Entry` verwenden `date` (Trainingsdatum), nicht `createdAt`. Betrifft Backend-Sortierung, Pull-Cap (`entriesLimit`) und lokale Cap-Eviction gleichermaßen. `createdAt`/`updatedAt` bleiben als Sync-/Audit-Zeitstempel bestehen, bestimmen aber bei `Entry` nicht die fachliche Sortierung.