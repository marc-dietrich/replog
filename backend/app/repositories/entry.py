"""Entry repository."""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Entry
from app.repositories.base import BaseRepository


class EntryRepository(BaseRepository[Entry]):
    """Entry data repository."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository."""
        super().__init__(session, Entry)

    async def get_by_exercise_id(
        self, exercise_id: UUID, user_id: UUID
    ) -> list[Entry]:
        """Get entries by exercise ID."""
        # Verify the exercise belongs to the user
        from sqlalchemy import join

        from app.models import Exercise

        stmt = (
            select(Entry)
            .join(Exercise)
            .where((Entry.exercise_id == exercise_id) & (Exercise.user_id == user_id))
            .order_by(Entry.date.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(self, id: UUID, user_id: UUID) -> Entry | None:
        """Get entry by ID and verify it belongs to user."""
        from sqlalchemy import join

        from app.models import Exercise

        stmt = (
            select(Entry)
            .join(Exercise)
            .where((Entry.id == id) & (Exercise.user_id == user_id))
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_exercise_and_date(
        self, exercise_id: UUID, date_: date, user_id: UUID
    ) -> list[Entry]:
        """Get entries by exercise ID and date."""
        from sqlalchemy import join

        from app.models import Exercise

        stmt = (
            select(Entry)
            .join(Exercise)
            .where(
                (Entry.exercise_id == exercise_id)
                & (Entry.date == date_)
                & (Exercise.user_id == user_id)
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
