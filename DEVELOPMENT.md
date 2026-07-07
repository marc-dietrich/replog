# Gym Tracker Backend - Entwicklung

## Schnellstart (macOS/Linux)

```bash
chmod +x start-backend.sh
./start-backend.sh
```

Dieser Skript wird automatisch:
1. Virtual Environment erstellen
2. Dependencies installieren
3. PostgreSQL Container starten
4. Datenbank initialisieren
5. Development Server starten

Die API ist dann verfügbar unter: **http://localhost:8000**

API Dokumentation: **http://localhost:8000/docs**

## Manuelle Setup

```bash
# 1. Virtual Environment
python3.13 -m venv venv
source venv/bin/activate

# Install dependencies
cd backend
pip install -r requirements-dev.txt
# oder für nur die Basis-Dependencies:
pip install -r requirements.txt

# 3. PostgreSQL starten
docker-compose up -d postgres

# 4. .env erstellen und anpassen
cp .env.example .env

# 5. Datenbank initialisieren
alembic upgrade head

# 6. Server starten
uvicorn app.main:app --reload
```

## Development Workflows

### Neue Migration erstellen

```bash
alembic revision --autogenerate -m "description"
# Änderungen anschauen und anpassen
alembic upgrade head
```

### Tests ausführen

```bash
pytest                           # Alle Tests
pytest tests/test_auth.py        # Spezifische Datei
pytest -v                        # Verbose
pytest --cov=app                 # Mit Coverage
pytest -k test_create_guest_auth # Nach Name filtern
```

### Code formatieren

```bash
# Black (Formatter)
black app/ tests/

# isort (Import Sorter)
isort app/ tests/

# Ruff (Linter)
ruff check app/ tests/ --fix

# Type Check
mypy app/
```

### Database Commands

```bash
# Status anzeigen
alembic current

# History
alembic history

# Zu Version gehen
alembic downgrade -1
alembic upgrade head

# Datenbank zurücksetzen
docker-compose down -v
docker-compose up -d postgres
alembic upgrade head
```

## API Testen

### Mit curl

```bash
# Guest User erstellen
curl -X POST http://localhost:8000/api/auth/guest

# Aktuelle User Info (mit Token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/auth/me

# Übung erstellen
curl -X POST http://localhost:8000/api/exercises \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bench Press"}'
```

### Mit Python

```python
import httpx
import asyncio

async def test():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Guest user
        response = await client.post("/api/auth/guest")
        token = response.json()["access_token"]
        
        # Get user
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(response.json())

asyncio.run(test())
```

### Mit Postman/Insomnia

1. Import der OpenAPI Spec: http://localhost:8000/openapi.json
2. Bearer Token Authentifizierung konfigurieren
3. Requests testen

## Common Issues

### `ModuleNotFoundError: No module named 'app'`
→ `cd backend` und `uvicorn app.main:app --reload` ausführen

### Database Connection Error
```bash
# Container Logs prüfen
docker-compose logs postgres

# Container neu starten
docker-compose restart postgres
```

### Migration Error
```bash
# Aktuelle Version anzeigen
alembic current

# Zu bestimmter Version zurück
alembic downgrade 001_initial

# Neu ausführen
alembic upgrade head
```

### Port 8000 already in use
```bash
# Anderen Process auf Port 8000 finden
lsof -i :8000

# Mit anderem Port starten
uvicorn app.main:app --reload --port 8001
```

## Debugging

### Debug-Mode aktivieren
```bash
# In .env:
DEBUG=true
DATABASE_ECHO=true

# Server neu starten
```

### Logs anschauen
```bash
# Terminal 1: Server-Logs
uvicorn app.main:app --reload --log-level debug

# Terminal 2: Database-Logs
docker-compose logs -f postgres
```

### Database Introspection
```bash
# Mit psql in Container
docker-compose exec postgres psql -U user -d gym_tracker

# SQL Queries
\dt                    # Alle Tabellen
\d users               # Schema der users Tabelle
SELECT * FROM users;   # Daten ansehen
```

## Performance Tipps

1. **Indizes prüfen**: Alle häufig gefilterten Felder sollten indiziert sein
2. **N+1 Queries vermeiden**: SQLAlchemy `joinedload()` nutzen
3. **Batch-Operationen**: Mehrere Updates zusammenfassen
4. **Connection Pooling**: Bereits konfiguriert in `db/__init__.py`

## Weitere Ressourcen

- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/20/)
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [Pytest Docs](https://docs.pytest.org/)

## Häufige Features

### Neuen Endpoint hinzufügen

1. **Schema erstellen** (`app/schemas/__init__.py`):
```python
class MyRequest(BaseModel):
    field: str
```

2. **Router erstellen** (`app/api/my_feature.py`):
```python
router = APIRouter(prefix="/my-feature", tags=["my-feature"])

@router.post("")
async def create_item(
    request: MyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # ...
```

3. **In `app/main.py` include_router**:
```python
from app.api import my_feature
app.include_router(my_feature.router, prefix=settings.API_PREFIX)
```

### Neues Model hinzufügen

1. Klasse in `app/models/__init__.py` hinzufügen
2. Repository in `app/repositories/` erstellen
3. Service in `app/services/` erstellen
4. API Router in `app/api/` erstellen
5. Migration mit Alembic ausführen

## FAQ

**F: Wie debugge ich eine SQL Query?**
A: `DATABASE_ECHO=true` in `.env` setzen, dann werden alle SQL Queries printed

**F: Wie teste ich mit Echtdaten?**
A: `docker-compose exec backend python` und dann `app.models` importieren

**F: Wie ändere ich den Database-Host?**
A: Nur `DATABASE_URL` in `.env` ändern, z.B. für Remote-DB

**F: Wie Backups erstellen?**
A: `docker-compose exec postgres pg_dump -U user gym_tracker > backup.sql`
