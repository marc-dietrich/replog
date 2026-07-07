"""Integration tests for exercise endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_exercise_group(client: AsyncClient):
    """Test creating exercise group."""
    # Create guest user
    response = await client.post("/api/auth/guest")
    token = response.json()["access_token"]

    # Create exercise group
    response = await client.post(
        "/api/groups",
        json={"name": "Chest", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Chest"
    assert "id" in data
    assert "user_id" in data


@pytest.mark.asyncio
async def test_list_exercise_groups(client: AsyncClient):
    """Test listing exercise groups."""
    # Create guest user
    response = await client.post("/api/auth/guest")
    token = response.json()["access_token"]

    # List groups (should be empty)
    response = await client.get(
        "/api/groups",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_exercise(client: AsyncClient):
    """Test creating exercise."""
    # Create guest user
    response = await client.post("/api/auth/guest")
    token = response.json()["access_token"]

    # Create exercise
    response = await client.post(
        "/api/exercises",
        json={"name": "Bench Press", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Bench Press"


@pytest.mark.asyncio
async def test_create_entry(client: AsyncClient):
    """Test creating entry."""
    from datetime import date
    from decimal import Decimal

    # Create guest user
    response = await client.post("/api/auth/guest")
    token = response.json()["access_token"]

    # Create exercise
    response = await client.post(
        "/api/exercises",
        json={"name": "Bench Press", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    exercise_id = response.json()["id"]

    # Create entry
    response = await client.post(
        "/api/entries",
        json={
            "exercise_id": exercise_id,
            "date": str(date.today()),
            "weight": "100.00",
            "reps": 10,
            "note": "Good session",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reps"] == 10
