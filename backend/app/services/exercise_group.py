"""Exercise group service."""

from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models import ExerciseGroup
from app.repositories.exercise_group import ExerciseGroupRepository


class ExerciseGroupService:
    """Exercise group business logic."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service."""
        self.session = session
        self.repo = ExerciseGroupRepository(session)

    async def create_group(
        self, user_id: UUID, name: str, sort_order: int = 0
    ) -> ExerciseGroup:
        """Create exercise group."""
        group = ExerciseGroup(
            id=uuid4(),
            user_id=user_id,
            name=name,
            sort_order=sort_order,
        )
        group = await self.repo.create(group)
        await self.repo.commit()
        return group

    async def get_group(self, group_id: UUID, user_id: UUID) -> ExerciseGroup:
        """Get exercise group."""
        group = await self.repo.get_by_id_and_user(group_id, user_id)
        if not group:
            raise NotFoundException("Exercise group not found")
        return group

    async def get_user_groups(self, user_id: UUID) -> list[ExerciseGroup]:
        """Get all groups for user."""
        return await self.repo.get_by_user_id(user_id)

    async def update_group(
        self, group_id: UUID, user_id: UUID, name: str | None = None, sort_order: int | None = None
    ) -> ExerciseGroup:
        """Update exercise group."""
        group = await self.get_group(group_id, user_id)
        if name is not None:
            group.name = name
        if sort_order is not None:
            group.sort_order = sort_order
        group = await self.repo.update(group)
        await self.repo.commit()
        return group

    async def delete_group(self, group_id: UUID, user_id: UUID) -> None:
        """Delete exercise group."""
        group = await self.get_group(group_id, user_id)
        await self.repo.delete(group)
        await self.repo.commit()
