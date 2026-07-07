"""Create Alembic migration."""

import sys
import asyncio
from alembic.config import Config as AlembicConfig
from alembic import command


def create_migration(message: str) -> None:
    """Create a new migration."""
    alembic_cfg = AlembicConfig("backend/alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", "postgresql://placeholder")
    alembic_cfg.set_main_option("script_location", "backend/alembic")

    command.revision(alembic_cfg, autogenerate=True, message=message)
    print(f"✅ Migration '{message}' created")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_migration.py '<migration message>'")
        sys.exit(1)

    message = " ".join(sys.argv[1:])
    create_migration(message)
