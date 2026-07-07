"""SQLAlchemy models for the database."""

from datetime import date
from decimal import Decimal
from enum import Enum
from uuid import UUID

from sqlalchemy import DECIMAL, DATE, ForeignKey, String, Text, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel


class UserStatus(str, Enum):
    """User status enum."""

    UNCLAIMED = "UNCLAIMED"
    ACTIVE = "ACTIVE"


class User(BaseModel):
    """User model."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        String(20), default=UserStatus.UNCLAIMED, nullable=False
    )

    # Relationships
    groups: Mapped[list["ExerciseGroup"]] = relationship(
        "ExerciseGroup", back_populates="user", cascade="all, delete-orphan"
    )
    exercises: Mapped[list["Exercise"]] = relationship(
        "Exercise", back_populates="user", cascade="all, delete-orphan"
    )
    migrations: Mapped[list["Migration"]] = relationship(
        "Migration", back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_user_email", "email"),)


class ExerciseGroup(BaseModel):
    """Exercise group model."""

    __tablename__ = "exercise_groups"

    id: Mapped[UUID] = mapped_column(primary_key=True, nullable=False)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="groups")
    exercises: Mapped[list["Exercise"]] = relationship(
        "Exercise", back_populates="group", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_group_user", "user_id"),
        Index("idx_group_user_sort", "user_id", "sort_order"),
    )


class Exercise(BaseModel):
    """Exercise model."""

    __tablename__ = "exercises"

    id: Mapped[UUID] = mapped_column(primary_key=True, nullable=False)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("exercise_groups.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    legacy_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="exercises")
    group: Mapped[ExerciseGroup | None] = relationship(
        "ExerciseGroup", back_populates="exercises"
    )
    entries: Mapped[list["Entry"]] = relationship(
        "Entry", back_populates="exercise", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_exercise_user", "user_id"),
        Index("idx_exercise_group", "group_id"),
        Index("idx_exercise_user_sort", "user_id", "sort_order"),
    )


class Entry(BaseModel):
    """Workout entry model."""

    __tablename__ = "entries"

    id: Mapped[UUID] = mapped_column(primary_key=True, nullable=False)
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(DATE, nullable=False)
    weight: Mapped[Decimal] = mapped_column(DECIMAL(6, 2), nullable=False)
    reps: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    exercise: Mapped[Exercise] = relationship("Exercise", back_populates="entries")

    __table_args__ = (
        Index("idx_entry_exercise", "exercise_id"),
        Index("idx_entry_date", "date"),
        Index("idx_entry_exercise_date", "exercise_id", "date"),
    )


class Migration(BaseModel):
    """Migration record model."""

    __tablename__ = "migrations"

    id: Mapped[UUID] = mapped_column(primary_key=True, nullable=False)
    migration_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    payload: Mapped[dict] = mapped_column(nullable=False)  # type: ignore
    claimed: Mapped[bool] = mapped_column(default=False, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    user: Mapped[User | None] = relationship("User", back_populates="migrations")

    __table_args__ = (
        Index("idx_migration_token", "migration_token"),
        Index("idx_migration_claimed", "claimed"),
    )
