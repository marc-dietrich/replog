"""Base repository with common CRUD operations."""

from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations."""

    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        """Initialize repository."""
        self.session = session
        self.model = model

    async def get_by_id(self, id: UUID) -> T | None:
        """Get record by ID."""
        stmt = select(self.model).where(self.model.id == id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_all(self) -> list[T]:
        """Get all records."""
        stmt = select(self.model)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, obj: T) -> T:
        """Create new record."""
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, obj: T) -> T:
        """Update record."""
        await self.session.merge(obj)
        await self.session.flush()
        return obj

    async def delete(self, obj: T) -> None:
        """Delete record."""
        await self.session.delete(obj)
        await self.session.flush()

    async def delete_by_id(self, id: UUID) -> bool:
        """Delete record by ID."""
        obj = await self.get_by_id(id)
        if obj:
            await self.delete(obj)
            return True
        return False

    async def commit(self) -> None:
        """Commit transaction."""
        await self.session.commit()

    async def rollback(self) -> None:
        """Rollback transaction."""
        await self.session.rollback()
