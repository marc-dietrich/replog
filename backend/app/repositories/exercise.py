"""Exercise repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise
from app.repositories.base import BaseRepository


class ExerciseRepository(BaseRepository[Exercise]):
    """Exercise data repository."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository."""
        super().__init__(session, Exercise)

    async def get_by_user_id(self, user_id: UUID) -> list[Exercise]:
        """Get exercises by user ID."""
        stmt = (
            select(Exercise)
            .where(Exercise.user_id == user_id)
            .order_by(Exercise.sort_order)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(self, id: UUID, user_id: UUID) -> Exercise | None:
        """Get exercise by ID and verify it belongs to user."""
        stmt = select(Exercise).where(
            (Exercise.id == id) & (Exercise.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_group_id(self, group_id: UUID, user_id: UUID) -> list[Exercise]:
        """Get exercises by group ID."""
        stmt = (
            select(Exercise)
            .where((Exercise.group_id == group_id) & (Exercise.user_id == user_id))
            .order_by(Exercise.sort_order)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
