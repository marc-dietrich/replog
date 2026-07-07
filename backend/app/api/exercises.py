"""Exercise API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas import ExerciseCreate, ExerciseResponse, ExerciseUpdate
from app.services.exercise import ExerciseService

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseResponse]:
    """List all exercises for current user."""
    service = ExerciseService(session)
    exercises = await service.get_user_exercises(current_user.id)
    return [
        ExerciseResponse(
            id=e.id,
            user_id=e.user_id,
            group_id=e.group_id,
            name=e.name,
            sort_order=e.sort_order,
            legacy_id=e.legacy_id,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in exercises
    ]


@router.post("", response_model=ExerciseResponse)
async def create_exercise(
    request: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    """Create new exercise."""
    service = ExerciseService(session)
    exercise = await service.create_exercise(
        user_id=current_user.id,
        name=request.name,
        group_id=request.group_id,
        sort_order=request.sort_order,
    )
    return ExerciseResponse(
        id=exercise.id,
        user_id=exercise.user_id,
        group_id=exercise.group_id,
        name=exercise.name,
        sort_order=exercise.sort_order,
        legacy_id=exercise.legacy_id,
        created_at=exercise.created_at,
        updated_at=exercise.updated_at,
    )


@router.patch("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: UUID,
    request: ExerciseUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExerciseResponse:
    """Update exercise."""
    service = ExerciseService(session)
    exercise = await service.update_exercise(
        exercise_id=exercise_id,
        user_id=current_user.id,
        name=request.name,
        group_id=request.group_id,
        sort_order=request.sort_order,
    )
    return ExerciseResponse(
        id=exercise.id,
        user_id=exercise.user_id,
        group_id=exercise.group_id,
        name=exercise.name,
        sort_order=exercise.sort_order,
        legacy_id=exercise.legacy_id,
        created_at=exercise.created_at,
        updated_at=exercise.updated_at,
    )


@router.delete("/{exercise_id}")
async def delete_exercise(
    exercise_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Delete exercise."""
    service = ExerciseService(session)
    await service.delete_exercise(exercise_id=exercise_id, user_id=current_user.id)
    return {"message": "Exercise deleted successfully"}


@router.get("/{exercise_id}/entries", response_model=list)
async def list_entries(
    exercise_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """List all entries for exercise."""
    from app.schemas import EntryResponse
    from app.services.entry import EntryService

    service = EntryService(session)
    entries = await service.get_exercise_entries(exercise_id, current_user.id)
    return [
        EntryResponse(
            id=e.id,
            exercise_id=e.exercise_id,
            date=e.date,
            weight=e.weight,
            reps=e.reps,
            note=e.note,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in entries
    ]
