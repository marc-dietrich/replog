# RepLog – Production Deployment

## Architektur

```
                    ┌──────────────────┐
   Internet ───────►│ Cloudflare Tunnel│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              ▼              │
              │  ┌─────────────────────┐   │
              │  │   OAuth2 Proxy      │   │  (optional)
              │  │   (Port 4180)       │   │
              │  └──────────┬──────────┘   │
              │             ▼              │
              │  ┌─────────────────────┐   │
              │  │   Frontend (Nginx)  │   │
              │  │   Port 80 → 8080    │   │
              │  └──────────┬──────────┘   │
              │             │ /api/*       │
              │             ▼              │
              │  ┌─────────────────────┐   │
              │  │   Backend (Express) │   │
              │  │   Port 3001         │   │
              │  └──────────┬──────────┘   │
              │             ▼              │
              │  ┌─────────────────────┐   │
              │  │   MongoDB 7         │   │
              │  │   Port 27017        │   │
              │  └─────────────────────┘   │
              │                            │
              │      Docker Network        │
              └────────────────────────────┘
```

## Quick Start

### 1. Environment vorbereiten

```bash
cp .env.example .env
# .env Datei ausfüllen – mindestens:
#   SESSION_SECRET, CLOUDFLARE_TUNNEL_TOKEN
# Für Google Login zusätzlich:
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

### 2. Stack starten (ohne OAuth2 Proxy)

```bash
docker compose up -d --build
```

Die App ist dann unter `http://localhost:8080` erreichbar.

### 3. Stack starten (mit OAuth2 Proxy)

```bash
docker compose --profile with-oauth-proxy up -d --build
```

Dann ist der geschützte Zugang unter Port `4180`.

### 4. Seed-Daten laden (optional)

```bash
docker compose exec backend node seed.js
```

---

## Services

| Service | Image | Port | Beschreibung |
|---------|-------|------|-------------|
| `frontend` | Custom (Nginx + Vite build) | 8080 | Statische React-App, proxied `/api` zum Backend |
| `backend` | Custom (Node 22) | 3001 (intern) | Express REST API |
| `mongo` | mongo:7 | 27017 (intern) | MongoDB Datenbank |
| `tunnel` | cloudflare/cloudflared | – | Cloudflare Tunnel für HTTPS |
| `oauth2-proxy` | oauth2-proxy v7.8.1 | 4180 | Google OAuth2 Gate (optional) |

---

## Cloudflare Tunnel einrichten

1. **Auf dem Server:**
   ```bash
   # cloudflared installieren (falls nicht vorhanden)
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared

   # Tunnel erstellen
   cloudflared tunnel login          # Browser-Auth bei Cloudflare
   cloudflared tunnel create replog  # Tunnel anlegen
   ```

2. **Im Cloudflare Dashboard:**
   - Zero Trust → Tunnels → `replog` → Configure
   - Public Hostname hinzufügen:
     - Domain: `replog.deinedomain.de`
     - Service: `http://frontend:80` (oder `http://oauth2-proxy:4180` wenn OAuth2 Proxy aktiv)
   - Tunnel Token kopieren → in `.env` als `CLOUDFLARE_TUNNEL_TOKEN` eintragen

3. **DNS:**
   - Cloudflare erstellt automatisch einen CNAME für den Tunnel

---

## Auth Flow (Guest → Google)

```
┌─────────┐   öffnet App    ┌─────────┐   GET /api/auth/me   ┌─────────┐
│ Browser │ ───────────────► │Frontend │ ──────────────────► │ Backend │
│         │                  │         │ ◄────────────────── │         │
│         │                  │         │   guest_id Cookie   │         │
│         │                  │         │   + leere Daten     │         │
└─────────┘                  └─────────┘                     └─────────┘
     │                                                            │
     │  Nutzt App als Gast (Daten werden über PUT /api/data       │
     │  im Guest-Dokument in MongoDB gespeichert)                 │
     │                                                            │
     │  Klickt "Sign in with Google"                              │
     │ ──► Google One-Tap Popup                                   │
     │ ◄── Google ID-Token (JWT)                                  │
     │                                                            │
     │  POST /api/auth/google { idToken, claimGuestData: true }   │
     │ ──────────────────────────────────────────────────────────► │
     │                                                            │
     │  Backend:                                                  │
     │  1. Verifiziert Google JWT                                 │
     │  2. Findet/erstellt Google-User                            │
     │  3. Übernimmt Guest-Daten → Google-User (wenn leer)        │
     │  4. Löscht Guest-Dokument                                  │
     │  5. Setzt session Cookie (30 Tage)                         │
     │                                                            │
     │ ◄──────────────────────────────────────────────────────────│
     │  session Cookie + User-Daten                               │
```

---

## Entwicklung (lokal ohne Docker)

```bash
# Backend
cd backend
npm install
MONGO_URI=mongodb://localhost:27017/replog npm run dev

# Frontend (in einem anderen Terminal)
cd frontend
npm install
npm run dev
# Vite dev-server proxied /api → localhost:3001
```

---

## API Endpunkte

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/health` | – | Health-Check |
| GET | `/api/auth/me` | Cookie | Aktueller User + State |
| POST | `/api/auth/google` | Cookie | Google Login + Guest-Claim |
| POST | `/api/auth/logout` | Cookie | Session beenden |
| GET | `/api/data` | Cookie | Exercises/Groups/Settings laden |
| PUT | `/api/data` | Cookie | Vollständigen State speichern |

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | Für Login | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Für OAuth2 Proxy | Google OAuth Client Secret |
| `SESSION_SECRET` | Ja | Secret für Session-JWTs |
| `CLOUDFLARE_TUNNEL_TOKEN` | Ja | Cloudflare Tunnel Token |
| `CORS_ORIGIN` | Nein | Erlaubte Origin (default: localhost:8080) |
| `OAUTH2_COOKIE_SECRET` | Für OAuth2 Proxy | 32-Byte Cookie Secret |
| `OAUTH2_REDIRECT_URL` | Für OAuth2 Proxy | OAuth2 Callback URL |
