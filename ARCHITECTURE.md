# Gym Tracker Backend - Architektur & Design

## Überblick

Das Gym Tracker Backend ist ein modernes, Python-basiertes REST API mit einer klaren Schichtenarchitektur:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│                     FAST API ROUTER LAYER                        │
│                    (app/api/*.py files)                          │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                   DEPENDENCY INJECTION LAYER                     │
│              (JWT Auth, Database Session)                        │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                      SERVICE LAYER                               │
│              (Business Logic, Validation)                        │
│              (app/services/*.py files)                           │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    REPOSITORY LAYER                              │
│              (Data Access Abstraction)                           │
│              (app/repositories/*.py files)                       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                   SQLALCHEMY ORM LAYER                           │
│                  (app/models/__init__.py)                        │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                   PostgreSQL Database                            │
│                     (Docker Container)                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Komponenten Details

### 1. API Layer (Router)

**Verantwortung:** HTTP Request/Response Handling

**Dateien:**
- `app/api/auth.py` - Authentifizierung
- `app/api/migrations.py` - Daten-Migrationen
- `app/api/groups.py` - Exercise Groups
- `app/api/exercises.py` - Exercises
- `app/api/entries.py` - Workout Entries

**Beispiel:**
```python
@router.post("/exercises", response_model=ExerciseResponse)
async def create_exercise(
    request: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    service = ExerciseService(session)
    exercise = await service.create_exercise(
        user_id=current_user.id,
        name=request.name,
    )
    return ExerciseResponse.from_orm(exercise)
```

**Features:**
- Type-sichere Request/Response Validation
- Automatische OpenAPI-Dokumentation
- Async/Await für Non-Blocking I/O

### 2. Dependency Injection

**Verantwortung:** Cross-Cutting Concerns

**Dateien:**
- `app/auth/dependencies.py` - JWT & User Extraction
- `app/db/__init__.py` - Database Session Provision

**Beispiel:**
```python
async def get_current_user(
    token: str = Depends(get_token_from_request),
    session: AsyncSession = Depends(get_session),
) -> User:
    payload = decode_token(token)
    user_id = UUID(payload.get("sub"))
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    return user
```

**Features:**
- Automatische User-Extraktion
- Session Management
- Token Validation

### 3. Service Layer

**Verantwortung:** Business Logic & Transactions

**Dateien:**
- `app/services/user.py` - User Management
- `app/services/exercise.py` - Exercise Operations
- `app/services/exercise_group.py` - Group Management
- `app/services/entry.py` - Workout Entry Logic
- `app/services/migration.py` - Data Migration

**Beispiel:**
```python
class ExerciseService:
    async def create_exercise(
        self,
        user_id: UUID,
        name: str,
        group_id: UUID | None = None,
    ) -> Exercise:
        exercise = Exercise(
            id=uuid4(),
            user_id=user_id,
            name=name,
            group_id=group_id,
        )
        exercise = await self.repo.create(exercise)
        await self.repo.commit()
        return exercise
```

**Features:**
- Input Validation
- Business Rule Enforcement
- Transaction Management
- User-specific Filtering

### 4. Repository Layer

**Verantwortung:** Data Access Abstraction

**Dateien:**
- `app/repositories/base.py` - Base CRUD Operations
- `app/repositories/user.py` - User Queries
- `app/repositories/exercise.py` - Exercise Queries
- `app/repositories/exercise_group.py` - Group Queries
- `app/repositories/entry.py` - Entry Queries
- `app/repositories/migration.py` - Migration Queries

**Beispiel:**
```python
class ExerciseRepository(BaseRepository[Exercise]):
    async def get_by_user_id(self, user_id: UUID) -> list[Exercise]:
        stmt = (
            select(Exercise)
            .where(Exercise.user_id == user_id)
            .order_by(Exercise.sort_order)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
```

**Features:**
- Query Building
- Automatic User Scoping
- Efficient Data Access
- Reusable Query Logic

### 5. Models (SQLAlchemy)

**Verantwortung:** Database Schema & ORM Mapping

**Dateien:**
- `app/models/__init__.py` - All SQLAlchemy Models
- `app/db/base.py` - Base Model Class

**Models:**
```python
class User(BaseModel):
    id: Mapped[UUID]
    email: Mapped[str | None]
    status: Mapped[UserStatus]
    # ... relationships

class Exercise(BaseModel):
    id: Mapped[UUID]
    user_id: Mapped[UUID]  # Foreign Key
    name: Mapped[str]
    # ... relationships
```

**Features:**
- Type Hints mit Mapped
- Automatic Timestamps
- Relationships with Cascade
- Indexes for Performance

### 6. Schemas (Pydantic)

**Verantwortung:** Request/Response Validation

**Dateien:**
- `app/schemas/__init__.py` - All Pydantic Schemas

**Beispiel:**
```python
class ExerciseCreate(BaseModel):
    name: str
    group_id: UUID | None = None
    sort_order: int = 0

class ExerciseResponse(ExerciseBase):
    id: UUID
    user_id: UUID
    created_at: datetime
```

**Features:**
- Type Validation
- JSON Serialization
- Auto-Documentation
- Nested Models

### 7. Authentication & Security

**Verantwortung:** JWT & Token Management

**Dateien:**
- `app/auth/security.py` - Token Operations
- `app/auth/dependencies.py` - Dependency Injection

**Beispiel:**
```python
def create_access_token(data: dict[str, Any]) -> str:
    """Create JWT token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jose_jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
```

**Features:**
- JWT Bearer Tokens
- Token Expiry
- Secure Token Generation
- User Extraction from Token

### 8. Configuration

**Verantwortung:** Environment & Settings Management

**Dateien:**
- `app/core/config.py` - Pydantic Settings
- `app/core/exceptions.py` - Custom Exceptions

**Beispiel:**
```python
class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    class Config:
        env_file = ".env"
```

## Datenfluss Beispiel: Exercise erstellen

```
1. REQUEST
   POST /api/exercises
   {"name": "Bench Press"}
   Authorization: Bearer <token>

2. ROUTER
   → create_exercise() in app/api/exercises.py
   → Validates request schema

3. DEPENDENCY INJECTION
   → get_current_user() extracted from token
   → get_session() provides database session

4. SERVICE
   → ExerciseService.create_exercise()
   → Validates business logic
   → Creates Exercise object

5. REPOSITORY
   → ExerciseRepository.create()
   → Executes SQL INSERT
   → Awaits database commit

6. DATABASE
   → PostgreSQL executes INSERT
   → Returns created row

7. RESPONSE
   → Converts to ExerciseResponse
   → Returns JSON 200 OK
```

## Security Principles

### 1. User-Scoped Queries

Alle Queries sind automatisch nach `user_id` gefiltert:

```python
# ✅ SAFE: Automatically filtered by user_id
stmt = select(Exercise).where(
    (Exercise.id == id) & (Exercise.user_id == user_id)
)

# ❌ NOT SAFE: Missing user filter
stmt = select(Exercise).where(Exercise.id == id)
```

### 2. JWT Authentication

- **Token Format:** Bearer <jwt_token>
- **Expiry:** 24 hours (configurable)
- **Refresh:** Not implemented (user must re-login)
- **Storage:** Stateless (no database lookup required)

### 3. Input Validation

Alle Inputs werden mit Pydantic validiert:

```python
class ExerciseCreate(BaseModel):
    name: str  # Required
    group_id: UUID | None = None  # Optional
    sort_order: int = Field(default=0, ge=0)  # Positive integer
```

### 4. Error Handling

Custom exceptions für klare Error-Codes:

```python
class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status_code=401)

# Usage:
if not user:
    raise NotFoundException("User not found")
```

## Database Schema

### Relationships

```
User (1) ──────► (N) ExerciseGroup
  │
  ├──────► (N) Exercise
  │             │
  │             └──────► (N) Entry
  │
  └──────► (N) Migration
```

### Indices

```sql
-- Schnelle Zugriffe
idx_user_email           -- Unique Email Lookup
idx_group_user_sort      -- User Groups + Ordering
idx_exercise_user_sort   -- User Exercises + Ordering
idx_entry_exercise_date  -- Exercise Entries by Date
idx_migration_token      -- Migration Token Lookup
idx_migration_claimed    -- Active Migrations Filter
```

## Performance Optimizations

### 1. Database

- **Connection Pooling:** Pool von 10, Max 20 overflow
- **Indices:** Auf häufig gefilterten Feldern
- **Foreign Keys:** Mit CASCADE für Konsistenz
- **Timestamps:** Server-seitiges NOW()

### 2. ORM

- **Lazy Loading:** Relationships geladen on-demand
- **Explicit Joins:** Wo notwendig zur Vermeidung von N+1
- **Efficient Queries:** SQLAlchemy optimierte Statements

### 3. API

- **Async/Await:** Non-blocking I/O
- **Type Hints:** Runtime-Optimierungen
- **Connection Reuse:** Pooled Sessions

## Testing Strategy

### Unit Tests

```python
# Repositories
async def test_get_exercise_by_user():
    repo = ExerciseRepository(session)
    exercise = await repo.get_by_user_id(user_id)
    assert exercise.user_id == user_id
```

### Integration Tests

```python
# API Endpoints
async def test_create_exercise(client):
    token = await create_guest_user(client)
    response = await client.post(
        "/api/exercises",
        json={"name": "Bench Press"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
```

### Test Fixtures

```python
@pytest.fixture
async def db_session():
    # Create test DB
    # Run migrations
    yield session
    # Cleanup
```

## Deployment Architecture

### Development

```
localhost:8000 → FastAPI Dev Server
              → PostgreSQL (Docker)
```

### Production

```
Load Balancer
      ↓
Docker Container (Backend)
      ↓
PostgreSQL RDS/Container
```

### Docker Layers

```
FROM python:3.13-slim
  ├─ Install dependencies
  ├─ Copy app code
  └─ Run uvicorn on port 8000
```

## Migration System (Legacy Data)

### Flow

```
Old System                New System
    │                         │
    └──────► POST /migrations─┘
             {exercises: [...]}
                 │
            Create Migration
            Generate Token
                 │
    ┌────────────┘
    │
    └──────► POST /migrations/claim
             {migration_token}
                 │
            Validate Token
            Create User
            Import Data
                 │
                 └──────► Database
```

## Error Handling Flow

```
Request
   ↓
Try Business Logic
   ├─ ValidationException (422)
   ├─ NotFoundException (404)
   ├─ ForbiddenException (403)
   ├─ UnauthorizedException (401)
   └─ AppException (generic)
   ↓
Exception Handler
   ↓
JSON Error Response + Status Code
```

## Future Enhancements

### Short Term
- [ ] Rate Limiting
- [ ] Caching (Redis)
- [ ] Batch Operations
- [ ] Advanced Filtering

### Medium Term
- [ ] OAuth Integration
- [ ] Email Verification
- [ ] Password Reset
- [ ] Analytics Dashboard

### Long Term
- [ ] GraphQL API
- [ ] WebSocket Real-time
- [ ] Machine Learning
- [ ] Mobile App Backend

## Deployment Checklist

- [ ] Change SECRET_KEY in production
- [ ] Set DEBUG=false
- [ ] Configure CORS_ORIGINS
- [ ] Enable HTTPS
- [ ] Setup database backups
- [ ] Configure logging
- [ ] Setup monitoring
- [ ] Configure health checks
- [ ] Setup CI/CD pipeline

## Monitoring & Observability

### Health Checks

```
GET /health → {"status": "ok"}
```

### Logging

```python
# In core/config.py
import logging
logger = logging.getLogger(__name__)
logger.info("User created", extra={"user_id": user.id})
```

### Metrics (Future)

- Request count & duration
- Database query performance
- Error rates
- Token expiry events

---

**Stand:** Juni 2026
**Version:** 0.1.0
**Status:** Dokumentation gültig für aktuelle Version
