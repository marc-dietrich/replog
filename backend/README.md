# Gym Tracker Backend

Produktionsreifes Backend für die Gym-Tracking-Anwendung mit FastAPI, PostgreSQL und SQLAlchemy 2.x.

## Features

- ✅ **Asynchrone API** mit FastAPI
- ✅ **PostgreSQL** mit SQLAlchemy 2.x
- ✅ **JWT Authentication** mit Bearer Tokens
- ✅ **Daten-Migration** von Alt-System mit sicheren Token
- ✅ **Repository-Pattern** für Datenzugriff
- ✅ **Service-Layer** für Business Logic
- ✅ **Docker & Docker Compose** für einfaches Deployment
- ✅ **Alembic-Migrationen** für Datenbank-Versionierung
- ✅ **Pytest Integration Tests**
- ✅ **Type Hints** (Python 3.13)
- ✅ **CORS** Support

## Technologie-Stack

- **Python 3.13**
- **FastAPI 0.115**
- **SQLAlchemy 2.0** (typed ORM)
- **PostgreSQL 16**
- **Alembic** für DB-Migrationen
- **Pydantic v2** für Validierung
- **Python-Jose** für JWT
- **Docker & Docker Compose**
- **uv** als Package Manager

## Installation

### Voraussetzungen

- Docker & Docker Compose
- Python 3.13 (für lokale Entwicklung)
- PostgreSQL 16 (oder Docker)

### Schnellstart mit Docker

```bash
# 1. Im Projekt-Root:
cp .env.docker .env

# 2. Docker-Container starten
docker-compose up -d

# 3. Datenbank-Migrationen ausführen
docker-compose exec backend alembic upgrade head

# 4. API ist verfügbar unter http://localhost:8000
```

### Lokale Entwicklung

```bash
# 1. Python Virtual Environment erstellen
python3.13 -m venv venv
source venv/bin/activate  # Linux/Mac
# oder: venv\Scripts\activate  # Windows

# 2. Abhängigkeiten mit uv installieren
uv pip install -e ".[dev]"

# 3. PostgreSQL starten
docker-compose up -d postgres

# 4. .env Datei erstellen
cp backend/.env.example backend/.env

# 5. Migrationen ausführen
cd backend
alembic upgrade head

# 6. Server starten
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Projektstruktur

```
backend/
├── app/
│   ├── api/              # FastAPI Router
│   ├── auth/             # JWT & Security
│   ├── core/             # Config & Exceptions
│   ├── db/               # Database Setup
│   ├── models/           # SQLAlchemy Models
│   ├── repositories/     # Data Access Layer
│   ├── schemas/          # Pydantic Schemas
│   ├── services/         # Business Logic
│   └── main.py           # App Entry Point
├── alembic/              # DB Migrations
│   └── versions/
├── tests/                # Integration Tests
├── pyproject.toml        # Dependencies (uv)
├── Dockerfile
└── start.sh
```

## API Dokumentation

### OpenAPI/Swagger

Interactive API Docs verfügbar unter:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Authentifizierung

Alle Endpoints (außer `/api/auth/guest`) benötigen JWT Bearer Token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/groups
```

## API Endpoints

### Authentication

#### Guest-Benutzer erstellen
```
POST /api/auth/guest
Response: { access_token, user_id, token_type }
```

#### Aktuelle Benutzerinformationen
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user: { id, email, display_name, status, created_at, updated_at } }
```

### Exercise Groups

#### Alle Gruppen auflisten
```
GET /api/groups
Headers: Authorization: Bearer <token>
```

#### Neue Gruppe erstellen
```
POST /api/groups
Headers: Authorization: Bearer <token>
Body: { name: string, sort_order?: number }
```

#### Gruppe aktualisieren
```
PATCH /api/groups/{group_id}
Headers: Authorization: Bearer <token>
Body: { name?: string, sort_order?: number }
```

#### Gruppe löschen
```
DELETE /api/groups/{group_id}
Headers: Authorization: Bearer <token>
```

### Exercises

#### Alle Übungen auflisten
```
GET /api/exercises
Headers: Authorization: Bearer <token>
```

#### Neue Übung erstellen
```
POST /api/exercises
Headers: Authorization: Bearer <token>
Body: { 
  name: string, 
  group_id?: UUID, 
  sort_order?: number 
}
```

#### Übung aktualisieren
```
PATCH /api/exercises/{exercise_id}
Headers: Authorization: Bearer <token>
Body: { name?: string, group_id?: UUID, sort_order?: number }
```

#### Übung löschen
```
DELETE /api/exercises/{exercise_id}
Headers: Authorization: Bearer <token>
```

#### Alle Einträge einer Übung
```
GET /api/exercises/{exercise_id}/entries
Headers: Authorization: Bearer <token>
```

### Entries (Workout-Einträge)

#### Neuen Eintrag erstellen
```
POST /api/entries
Headers: Authorization: Bearer <token>
Body: { 
  exercise_id: UUID, 
  date: YYYY-MM-DD, 
  weight: number, 
  reps: integer, 
  note?: string 
}
```

#### Eintrag aktualisieren
```
PATCH /api/entries/{entry_id}
Headers: Authorization: Bearer <token>
Body: { date?: date, weight?: number, reps?: integer, note?: string }
```

#### Eintrag löschen
```
DELETE /api/entries/{entry_id}
Headers: Authorization: Bearer <token>
```

### Migrations

#### Migration initiieren (von Alt-System)
```
POST /api/migrations
Body: { exercises: [...] }
Response: { migration_token: string, redirect_url: string }
```

#### Migration in Anspruch nehmen (neues System)
```
POST /api/migrations/claim
Body: { migration_token: string }
Response: { access_token: string, user_id: UUID, user: User }
```

## Datenmodelle

### User
```python
- id: UUID (Primary Key)
- email: str (nullable, unique)
- display_name: str (nullable)
- status: UNCLAIMED | ACTIVE
- created_at: datetime
- updated_at: datetime
```

### ExerciseGroup
```python
- id: UUID
- user_id: UUID (FK → User)
- name: str
- sort_order: int
- created_at: datetime
- updated_at: datetime
```

### Exercise
```python
- id: UUID
- user_id: UUID (FK → User)
- group_id: UUID (nullable, FK → ExerciseGroup)
- name: str
- sort_order: int
- legacy_id: str (nullable)
- created_at: datetime
- updated_at: datetime
```

### Entry
```python
- id: UUID
- exercise_id: UUID (FK → Exercise)
- date: date
- weight: DECIMAL(6,2)
- reps: integer
- note: str (nullable)
- created_at: datetime
- updated_at: datetime
```

### Migration
```python
- id: UUID
- migration_token: str (unique)
- payload: JSONB
- claimed: bool
- user_id: UUID (nullable, FK → User)
- created_at: datetime
- updated_at: datetime
```

## Sicherheit

### Datenschutz
- Alle Daten gehören einem User
- Automatische Filterung nach `user_id` in allen Queries
- Unmögliche Cross-User Data Access

### Authentication
- JWT Bearer Tokens
- 24h Token Expiry (konfigurierbar)
- Sichere Token-Generierung mit `secrets` Modul

### Migration Token
- Kryptographisch sichere Token mit `secrets.token_urlsafe(32)`
- Token-Expiry nach 7 Tagen (konfigurierbar)
- Nur einmalige Nutzung

## Datenbank-Migrationen

```bash
# Neue Migration erstellen
alembic revision --autogenerate -m "description"

# Migrationen ausführen
alembic upgrade head

# Letzten Schritt rückgängig machen
alembic downgrade -1

# Migration History anzeigen
alembic current
alembic history
```

## Tests ausführen

```bash
# Alle Tests
pytest

# Mit Coverage
pytest --cov=app

# Spezifischen Test ausführen
pytest tests/test_auth.py::test_create_guest_auth -v

# Tests im Watch-Mode
ptw
```

## Environment-Variablen

```env
# Database
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/gym_tracker
DATABASE_ECHO=false

# JWT
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Server
DEBUG=false
ENVIRONMENT=development

# CORS
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# Migration
MIGRATION_TOKEN_EXPIRY_DAYS=7
```

## Development Tools

### Code Formatting
```bash
# Mit Black formatieren
black app/ tests/

# Mit isort sortieren
isort app/ tests/

# Mit Ruff linten
ruff check app/ tests/
```

### Type Checking
```bash
mypy app/
```

## Docker Commands

```bash
# Container starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f backend

# Container stoppen
docker-compose down

# Datenbank zurücksetzen
docker-compose down -v
docker-compose up -d
```

## Production-Deployment

### Checkliste

- [ ] `SECRET_KEY` in `.env` ändern
- [ ] `DEBUG=false` setzen
- [ ] `ENVIRONMENT=production` setzen
- [ ] CORS_ORIGINS anpassen
- [ ] Database SSL aktivieren
- [ ] JWT expiry ggf. anpassen
- [ ] Logging konfigurieren
- [ ] Health-Checks setzen
- [ ] Backups planen

### Docker Production Build

```bash
docker build -t gym-tracker-backend:v1 ./backend
docker run -d \
  --name gym-tracker-backend \
  -e DATABASE_URL=postgresql://... \
  -e SECRET_KEY=... \
  -p 8000:8000 \
  gym-tracker-backend:v1
```

## Troubleshooting

### Database Connection Error
```bash
# Verbindung testen
psql postgresql://user:password@localhost:5432/gym_tracker

# Container Logs
docker-compose logs postgres
```

### Migration Error
```bash
# Migrationen anzeigen
alembic current

# Zu spezifischer Version gehen
alembic downgrade 001_initial
alembic upgrade head
```

### Token Invalid
- Token-Expiry prüfen
- SECRET_KEY muss identisch sein
- Bearer prefix muss vorhanden sein

## Weitere Ressourcen

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)

## License

MIT

## Kontakt

Für Fragen oder Issues: Marc [email]
