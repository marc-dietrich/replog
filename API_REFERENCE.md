"""Gym Tracker Backend - Vollständige API Referenz.

Diese Datei dokumentiert alle verfügbaren API Endpoints.
"""

# Authentication

## Create Guest User
POST /api/auth/guest

Request:
  -

Response (200):
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }

---

## Get Current User
GET /api/auth/me

Headers:
  Authorization: Bearer <token>

Response (200):
  {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": null,
      "display_name": null,
      "status": "UNCLAIMED",
      "created_at": "2026-06-27T10:00:00+00:00",
      "updated_at": "2026-06-27T10:00:00+00:00"
    }
  }

Errors:
  401: Unauthorized - Invalid or missing token

---

# Migrations

## Initiate Migration (Old System)
POST /api/migrations

Request:
  {
    "exercises": [
      {
        "id": "1764086786541",
        "name": "Breites Rudern",
        "groupId": "1771967411282",
        "order": 2,
        "entries": [
          {
            "date": "2026-03-16",
            "weight": 60,
            "reps": 8,
            "note": ""
          }
        ]
      }
    ]
  }

Response (200):
  {
    "migration_token": "0WlNbfr3S-JvKGQ9_5ZlKWELq...",
    "redirect_url": "https://localhost:5173/import?token=..."
  }

---

## Claim Migration (New System)
POST /api/migrations/claim

Request:
  {
    "migration_token": "0WlNbfr3S-JvKGQ9_5ZlKWELq..."
  }

Response (200):
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": null,
      "display_name": null,
      "status": "UNCLAIMED",
      "created_at": "2026-06-27T10:00:00+00:00",
      "updated_at": "2026-06-27T10:00:00+00:00"
    }
  }

Errors:
  404: Migration not found
  422: Migration already claimed or expired

---

# Exercise Groups

## List Groups
GET /api/groups

Headers:
  Authorization: Bearer <token>

Query Parameters:
  -

Response (200):
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Chest",
      "sort_order": 0,
      "created_at": "2026-06-27T10:00:00+00:00",
      "updated_at": "2026-06-27T10:00:00+00:00"
    }
  ]

Errors:
  401: Unauthorized

---

## Create Group
POST /api/groups

Headers:
  Authorization: Bearer <token>

Request:
  {
    "name": "Chest",
    "sort_order": 0
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chest",
    "sort_order": 0,
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:00:00+00:00"
  }

Errors:
  401: Unauthorized
  422: Validation Error

---

## Update Group
PATCH /api/groups/{group_id}

Headers:
  Authorization: Bearer <token>

Path Parameters:
  group_id: UUID

Request:
  {
    "name": "Chest & Back",
    "sort_order": 1
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chest & Back",
    "sort_order": 1,
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:05:00+00:00"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Group not found
  422: Validation Error

---

## Delete Group
DELETE /api/groups/{group_id}

Headers:
  Authorization: Bearer <token>

Path Parameters:
  group_id: UUID

Response (200):
  {
    "message": "Group deleted successfully"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Group not found

---

# Exercises

## List Exercises
GET /api/exercises

Headers:
  Authorization: Bearer <token>

Response (200):
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "group_id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Bench Press",
      "sort_order": 0,
      "legacy_id": "1001",
      "created_at": "2026-06-27T10:00:00+00:00",
      "updated_at": "2026-06-27T10:00:00+00:00"
    }
  ]

Errors:
  401: Unauthorized

---

## Create Exercise
POST /api/exercises

Headers:
  Authorization: Bearer <token>

Request:
  {
    "name": "Bench Press",
    "group_id": "550e8400-e29b-41d4-a716-446655440001",
    "sort_order": 0
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "group_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Bench Press",
    "sort_order": 0,
    "legacy_id": null,
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:00:00+00:00"
  }

Errors:
  401: Unauthorized
  422: Validation Error

---

## Update Exercise
PATCH /api/exercises/{exercise_id}

Headers:
  Authorization: Bearer <token>

Request:
  {
    "name": "Incline Bench Press",
    "group_id": null,
    "sort_order": 1
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "group_id": null,
    "name": "Incline Bench Press",
    "sort_order": 1,
    "legacy_id": null,
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:05:00+00:00"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Exercise not found
  422: Validation Error

---

## Delete Exercise
DELETE /api/exercises/{exercise_id}

Headers:
  Authorization: Bearer <token>

Response (200):
  {
    "message": "Exercise deleted successfully"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Exercise not found

---

## Get Exercise Entries
GET /api/exercises/{exercise_id}/entries

Headers:
  Authorization: Bearer <token>

Response (200):
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "exercise_id": "550e8400-e29b-41d4-a716-446655440002",
      "date": "2026-06-27",
      "weight": 100.50,
      "reps": 8,
      "note": "Felt strong",
      "created_at": "2026-06-27T10:00:00+00:00",
      "updated_at": "2026-06-27T10:00:00+00:00"
    }
  ]

Errors:
  401: Unauthorized
  403: Forbidden
  404: Exercise not found

---

# Entries

## Create Entry
POST /api/entries

Headers:
  Authorization: Bearer <token>

Request:
  {
    "exercise_id": "550e8400-e29b-41d4-a716-446655440002",
    "date": "2026-06-27",
    "weight": 100.50,
    "reps": 8,
    "note": "Felt strong"
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "exercise_id": "550e8400-e29b-41d4-a716-446655440002",
    "date": "2026-06-27",
    "weight": 100.50,
    "reps": 8,
    "note": "Felt strong",
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:00:00+00:00"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Exercise not found
  422: Validation Error

---

## Update Entry
PATCH /api/entries/{entry_id}

Headers:
  Authorization: Bearer <token>

Request:
  {
    "date": "2026-06-27",
    "weight": 102.50,
    "reps": 7,
    "note": "Good effort"
  }

Response (200):
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "exercise_id": "550e8400-e29b-41d4-a716-446655440002",
    "date": "2026-06-27",
    "weight": 102.50,
    "reps": 7,
    "note": "Good effort",
    "created_at": "2026-06-27T10:00:00+00:00",
    "updated_at": "2026-06-27T10:05:00+00:00"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Entry not found
  422: Validation Error

---

## Delete Entry
DELETE /api/entries/{entry_id}

Headers:
  Authorization: Bearer <token>

Response (200):
  {
    "message": "Entry deleted successfully"
  }

Errors:
  401: Unauthorized
  403: Forbidden
  404: Entry not found

---

# Common Error Responses

## 401 Unauthorized
{
  "detail": "Not authenticated"
}

## 403 Forbidden
{
  "detail": "Forbidden"
}

## 404 Not Found
{
  "detail": "Not Found"
}

## 422 Unprocessable Entity
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}

---

# Rate Limiting

Derzeit nicht implementiert. Kann bei Bedarf mit:
- SlowAPI
- Redis-Cache
- Custom Middleware

hinzugefügt werden.

---

# Versioning

API Version: v1
Backend Version: 0.1.0

Verfügbar unter: /api/v1/* (geplant für zukünftige Versionen)

---

# CORS

Folgende Origins sind standardmäßig erlaubt:
- http://localhost:5173
- http://localhost:3000

Weitere Origins können in .env hinzugefügt werden.

---

# Content-Type

Alle Requests müssen:
Content-Type: application/json

enthalten (außer File Uploads).

---

# Authentifizierung

Alle Endpoints außer:
- POST /api/auth/guest
- POST /api/migrations

benötigen einen gültigen JWT Bearer Token im Authorization Header.

Token Format: Authorization: Bearer <token>
Token Expiry: 24 Stunden (konfigurierbar)
Token Refresh: Nicht implementiert (User muss neu Login)

---

# Beispiele mit curl

## Guest User erstellen
curl -X POST http://localhost:8000/api/auth/guest

## Mit Token arbeiten
export TOKEN="..."

# Aktuelle User Info
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me

# Übung erstellen
curl -X POST http://localhost:8000/api/exercises \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bench Press", "sort_order": 0}'

# Alle Übungen auflisten
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/exercises

---

# Webhooks

Derzeit nicht implementiert.

---

# Batch Operations

Derzeit nicht implementiert. Es müssen einzelne Requests pro Objekt gemacht werden.

---

# Filtering & Pagination

Derzeit nicht implementiert. 

In Zukunft geplant:
- Filtering nach Datum, Übung, etc.
- Pagination für große Result Sets
- Sorting nach verschiedenen Feldern

---

# GraphQL

Derzeit nicht verfügbar. REST API ist Standard.

---

# WebSocket

Derzeit nicht verfügbar. Für Real-time Updates in Zukunft geplant.
"""
