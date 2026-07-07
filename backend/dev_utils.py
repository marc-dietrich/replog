"""Development utilities."""

import os
import sys

from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
from app.db import engine
from app.db.base import Base


async def init_db():
    """Initialize database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database initialized")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
