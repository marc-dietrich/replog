"""Entry API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas import EntryCreate, EntryResponse, EntryUpdate
from app.services.entry import EntryService

router = APIRouter(prefix="/entries", tags=["entries"])


@router.post("", response_model=EntryResponse)
async def create_entry(
    request: EntryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EntryResponse:
    """Create new entry."""
    from app.services.exercise import ExerciseService

    # Verify exercise belongs to user
    exercise_service = ExerciseService(session)
    exercise = await exercise_service.get_exercise(request.exercise_id, current_user.id)

    service = EntryService(session)
    entry = await service.create_entry(
        exercise_id=request.exercise_id,
        user_id=current_user.id,
        date_=request.date,
        weight=request.weight,
        reps=request.reps,
        note=request.note,
    )
    return EntryResponse(
        id=entry.id,
        exercise_id=entry.exercise_id,
        date=entry.date,
        weight=entry.weight,
        reps=entry.reps,
        note=entry.note,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.patch("/{entry_id}", response_model=EntryResponse)
async def update_entry(
    entry_id: UUID,
    request: EntryUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EntryResponse:
    """Update entry."""
    service = EntryService(session)
    entry = await service.update_entry(
        entry_id=entry_id,
        user_id=current_user.id,
        date_=request.date,
        weight=request.weight,
        reps=request.reps,
        note=request.note,
    )
    return EntryResponse(
        id=entry.id,
        exercise_id=entry.exercise_id,
        date=entry.date,
        weight=entry.weight,
        reps=entry.reps,
        note=entry.note,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Delete entry."""
    service = EntryService(session)
    await service.delete_entry(entry_id=entry_id, user_id=current_user.id)
    return {"message": "Entry deleted successfully"}
