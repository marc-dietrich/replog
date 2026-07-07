"""Integration tests for auth endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_guest_auth(client: AsyncClient):
    """Test creating guest user."""
    response = await client.post("/api/auth/guest")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "user_id" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient):
    """Test getting current user."""
    # First create guest user to get token
    response = await client.post("/api/auth/guest")
    token = response.json()["access_token"]

    # Get current user
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert data["user"]["status"] == "UNCLAIMED"
