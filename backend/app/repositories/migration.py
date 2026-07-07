"""Migration repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Migration
from app.repositories.base import BaseRepository


class MigrationRepository(BaseRepository[Migration]):
    """Migration data repository."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository."""
        super().__init__(session, Migration)

    async def get_by_token(self, token: str) -> Migration | None:
        """Get migration by token."""
        stmt = select(Migration).where(Migration.migration_token == token)
        result = await self.session.execute(stmt)
        return result.scalars().first()
