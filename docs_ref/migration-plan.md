# Domain Migration Strategy  
## Client-Side App (GitHub Pages) → Eigene Domain mit Backend

---

## Ziel

Nahtlose Migration einer rein clientseitigen Web-App (Speicherung in localStorage / IndexedDB)  
auf eine neue Domain mit Backend — ohne manuellen Export/Import durch den Nutzer.

---

## Problem

Browser-Speicher ist origin-gebunden.

https://meineapp.github.io  ≠  https://meineapp.de

Getrennt gespeichert werden:

- localStorage
- IndexedDB
- Cookies
- Cache Storage
- Service Worker

Ein normaler 301/302 Redirect reicht nicht aus.

---

# Lösung: Serverseitige Migration mit Einmal-Token

Migration über:

1. Backend-gestützte Datenspeicherung
2. Temporären Migration-Token
3. Serverseitigen Redirect mit HTTP-only Cookie

---

# Architektur

[ Alte Domain ]
        │
        │ POST /start-migration
        ▼
[ Backend API ]
        │
        │ 302 Redirect + Session Cookie
        ▼
[ Neue Domain ]

---

# Ablauf im Detail

## 1. Migration starten (alte Domain)

User klickt:
„Daten auf neue Domain übertragen“

Frontend:

```js
fetch("https://api.meineapp.de/start-migration", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: localStorage.getItem("userId"),
    data: localStorage.getItem("fitnessData")
  })
})
.then(res => res.json())
.then(result => {
  window.location.href = result.redirectUrl
})
```

---

## 2. Backend verarbeitet Migration

Server:

- Speichert Daten unter userId
- Generiert zufälligen migrationToken
- Speichert Mapping:

migrationToken → userId

Token Ablaufzeit: z. B. 10 Minuten  
Token nur einmal nutzbar

Antwort:

```json
{
  "redirectUrl": "https://api.meineapp.de/migrate/<token>"
}
```

---

## 3. Serverseitiger Redirect

User ruft auf:

https://api.meineapp.de/migrate/<token>

Server:

1. Validiert Token
2. Holt zugehörige userId
3. Setzt Cookie:

Set-Cookie:
  session=<signedUserId>;
  HttpOnly;
  Secure;
  SameSite=Lax;

4. Löscht Token (Einmal-Verwendung)
5. Sendet:

302 Redirect → https://meineapp.de

---

## 4. Neue Domain lädt Nutzerdaten

Frontend:

```js
fetch("https://api.meineapp.de/me", {
  credentials: "include"
})
```

Server:

- Liest session Cookie
- Liefert gespeicherte Daten zurück

Optional lokal speichern:

```js
localStorage.setItem("userId", returnedUserId)
```

Migration abgeschlossen.

---

# Sicherheitsregeln

- HTTPS verpflichtend
- Token kryptographisch zufällig
- Token zeitlich begrenzt
- Token nur einmal verwendbar
- HttpOnly + Secure Cookies
- CORS korrekt konfigurieren
- Keine userId direkt in URL der neuen Domain

---

# Warum kein reiner Redirect?

301 github.io → meineapp.de

führt zu Datenverlust, da Browser-Speicher domaingebunden ist.

---

# Vorteile

- Kein manueller Export/Import
- Kein Login erforderlich
- Keine IP-Bindung
- Nutzer merkt kaum etwas
- Erweiterbar für Cloud-Sync & Multi-Device

---

# Fazit

Die Migration erfolgt:

- kontrolliert
- sicher
- einmalig
- transparent für den Nutzer

Technisch entspricht der Ablauf einem Magic-Link-Login-Flow,
jedoch ausschließlich für die Datenmigration.