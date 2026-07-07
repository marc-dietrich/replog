"""Pydantic schemas for request/response validation."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# User Schemas
class UserBase(BaseModel):
    """Base user schema."""

    display_name: str | None = None


class UserCreate(UserBase):
    """User creation schema."""

    email: EmailStr | None = None


class UserUpdate(UserBase):
    """User update schema."""

    pass


class UserResponse(UserBase):
    """User response schema."""

    id: UUID
    email: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True


# Exercise Group Schemas
class ExerciseGroupBase(BaseModel):
    """Base exercise group schema."""

    name: str
    sort_order: int = 0


class ExerciseGroupCreate(ExerciseGroupBase):
    """Exercise group creation schema."""

    pass


class ExerciseGroupUpdate(BaseModel):
    """Exercise group update schema."""

    name: str | None = None
    sort_order: int | None = None


class ExerciseGroupResponse(ExerciseGroupBase):
    """Exercise group response schema."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True


# Exercise Schemas
class ExerciseBase(BaseModel):
    """Base exercise schema."""

    name: str
    group_id: UUID | None = None
    sort_order: int = 0


class ExerciseCreate(ExerciseBase):
    """Exercise creation schema."""

    pass


class ExerciseUpdate(BaseModel):
    """Exercise update schema."""

    name: str | None = None
    group_id: UUID | None = None
    sort_order: int | None = None


class ExerciseResponse(ExerciseBase):
    """Exercise response schema."""

    id: UUID
    user_id: UUID
    legacy_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True


# Entry Schemas
class EntryBase(BaseModel):
    """Base entry schema."""

    date: date
    weight: Decimal = Field(..., decimal_places=2, max_digits=6)
    reps: int = Field(..., gt=0)
    note: str | None = None


class EntryCreate(EntryBase):
    """Entry creation schema."""

    pass


class EntryUpdate(BaseModel):
    """Entry update schema."""

    date: date | None = None
    weight: Decimal | None = Field(None, decimal_places=2, max_digits=6)
    reps: int | None = Field(None, gt=0)
    note: str | None = None


class EntryResponse(EntryBase):
    """Entry response schema."""

    id: UUID
    exercise_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True


# Migration Schemas
class MigrationInitiate(BaseModel):
    """Migration initiation request schema."""

    exercises: list[dict] = Field(..., description="Legacy exercises data")


class MigrationInitiateResponse(BaseModel):
    """Migration initiation response schema."""

    migration_token: str
    redirect_url: str


class MigrationClaim(BaseModel):
    """Migration claim request schema."""

    migration_token: str


class MigrationClaimResponse(BaseModel):
    """Migration claim response schema."""

    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    user: UserResponse


# Auth Schemas
class TokenResponse(BaseModel):
    """Token response schema."""

    access_token: str
    token_type: str = "bearer"


class GuestAuthResponse(BaseModel):
    """Guest authentication response schema."""

    access_token: str
    token_type: str = "bearer"
    user_id: UUID


class CurrentUserResponse(BaseModel):
    """Current user response schema."""

    user: UserResponse
