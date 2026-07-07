"""Authentication and security utilities."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jose import JWTError, jwt as jose_jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedException


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jose_jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return str(encoded_jwt)


def decode_token(token: str) -> dict[str, Any]:
    """Decode JWT token."""
    try:
        payload = jose_jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise UnauthorizedException("Invalid token") from e


def generate_migration_token() -> str:
    """Generate secure migration token."""
    return secrets.token_urlsafe(32)


def verify_migration_token(token: str, created_at: datetime) -> bool:
    """Verify migration token hasn't expired."""
    expiry_date = created_at + timedelta(days=settings.MIGRATION_TOKEN_EXPIRY_DAYS)
    return datetime.now(timezone.utc) <= expiry_date.replace(tzinfo=timezone.utc)
