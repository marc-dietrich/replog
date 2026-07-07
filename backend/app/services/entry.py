"""Entry service."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models import Entry
from app.repositories.entry import EntryRepository


class EntryService:
    """Entry business logic."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service."""
        self.session = session
        self.repo = EntryRepository(session)

    async def create_entry(
        self,
        exercise_id: UUID,
        user_id: UUID,
        date_: date,
        weight: Decimal,
        reps: int,
        note: str | None = None,
    ) -> Entry:
        """Create entry."""
        entry = Entry(
            id=uuid4(),
            exercise_id=exercise_id,
            date=date_,
            weight=weight,
            reps=reps,
            note=note,
        )
        entry = await self.repo.create(entry)
        await self.repo.commit()
        return entry

    async def get_entry(self, entry_id: UUID, user_id: UUID) -> Entry:
        """Get entry."""
        entry = await self.repo.get_by_id_and_user(entry_id, user_id)
        if not entry:
            raise NotFoundException("Entry not found")
        return entry

    async def get_exercise_entries(self, exercise_id: UUID, user_id: UUID) -> list[Entry]:
        """Get all entries for exercise."""
        return await self.repo.get_by_exercise_id(exercise_id, user_id)

    async def update_entry(
        self,
        entry_id: UUID,
        user_id: UUID,
        date_: date | None = None,
        weight: Decimal | None = None,
        reps: int | None = None,
        note: str | None = None,
    ) -> Entry:
        """Update entry."""
        entry = await self.get_entry(entry_id, user_id)
        if date_ is not None:
            entry.date = date_
        if weight is not None:
            entry.weight = weight
        if reps is not None:
            entry.reps = reps
        if note is not None:
            entry.note = note
        entry = await self.repo.update(entry)
        await self.repo.commit()
        return entry

    async def delete_entry(self, entry_id: UUID, user_id: UUID) -> None:
        """Delete entry."""
        entry = await self.get_entry(entry_id, user_id)
        await self.repo.delete(entry)
        await self.repo.commit()
