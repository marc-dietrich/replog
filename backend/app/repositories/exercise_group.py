"""Exercise group repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExerciseGroup
from app.repositories.base import BaseRepository


class ExerciseGroupRepository(BaseRepository[ExerciseGroup]):
    """Exercise group data repository."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository."""
        super().__init__(session, ExerciseGroup)

    async def get_by_user_id(self, user_id: UUID) -> list[ExerciseGroup]:
        """Get groups by user ID."""
        stmt = (
            select(ExerciseGroup)
            .where(ExerciseGroup.user_id == user_id)
            .order_by(ExerciseGroup.sort_order)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(self, id: UUID, user_id: UUID) -> ExerciseGroup | None:
        """Get group by ID and verify it belongs to user."""
        stmt = select(ExerciseGroup).where(
            (ExerciseGroup.id == id) & (ExerciseGroup.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()
