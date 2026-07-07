"""Exercise Group API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas import ExerciseGroupCreate, ExerciseGroupResponse, ExerciseGroupUpdate
from app.services.exercise_group import ExerciseGroupService

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[ExerciseGroupResponse])
async def list_groups(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ExerciseGroupResponse]:
    """List all exercise groups for current user."""
    service = ExerciseGroupService(session)
    groups = await service.get_user_groups(current_user.id)
    return [
        ExerciseGroupResponse(
            id=g.id,
            user_id=g.user_id,
            name=g.name,
            sort_order=g.sort_order,
            created_at=g.created_at,
            updated_at=g.updated_at,
        )
        for g in groups
    ]


@router.post("", response_model=ExerciseGroupResponse)
async def create_group(
    request: ExerciseGroupCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExerciseGroupResponse:
    """Create new exercise group."""
    service = ExerciseGroupService(session)
    group = await service.create_group(
        user_id=current_user.id,
        name=request.name,
        sort_order=request.sort_order,
    )
    return ExerciseGroupResponse(
        id=group.id,
        user_id=group.user_id,
        name=group.name,
        sort_order=group.sort_order,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.patch("/{group_id}", response_model=ExerciseGroupResponse)
async def update_group(
    group_id: UUID,
    request: ExerciseGroupUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExerciseGroupResponse:
    """Update exercise group."""
    service = ExerciseGroupService(session)
    group = await service.update_group(
        group_id=group_id,
        user_id=current_user.id,
        name=request.name,
        sort_order=request.sort_order,
    )
    return ExerciseGroupResponse(
        id=group.id,
        user_id=group.user_id,
        name=group.name,
        sort_order=group.sort_order,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.delete("/{group_id}")
async def delete_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Delete exercise group."""
    service = ExerciseGroupService(session)
    await service.delete_group(group_id=group_id, user_id=current_user.id)
    return {"message": "Group deleted successfully"}
