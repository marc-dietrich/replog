"""Migration service."""

from datetime import timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, generate_migration_token, verify_migration_token
from app.core.config import settings
from app.core.exceptions import NotFoundException, ValidationException
from app.models import Migration, User, UserStatus
from app.repositories.migration import MigrationRepository
from app.repositories.user import UserRepository
from app.services.exercise import ExerciseService
from app.services.exercise_group import ExerciseGroupService
from app.services.entry import EntryService


class MigrationService:
    """Migration business logic."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service."""
        self.session = session
        self.migration_repo = MigrationRepository(session)
        self.user_repo = UserRepository(session)

    async def initiate_migration(self, payload: dict) -> tuple[str, str]:
        """Initiate data migration from old app."""
        token = generate_migration_token()

        migration = Migration(
            id=uuid4(),
            migration_token=token,
            payload=payload,
            claimed=False,
        )

        migration = await self.migration_repo.create(migration)
        await self.migration_repo.commit()

        redirect_url = (
            f"https://localhost:5173/import?token={token}"
            if settings.ENVIRONMENT == "development"
            else f"https://gym-tracker.example.com/import?token={token}"
        )

        return token, redirect_url

    async def claim_migration(self, token: str) -> tuple[User, str]:
        """Claim migration and import data."""
        migration = await self.migration_repo.get_by_token(token)
        if not migration:
            raise NotFoundException("Migration not found")

        if migration.claimed:
            raise ValidationException("Migration already claimed")

        if not verify_migration_token(token, migration.created_at):
            raise ValidationException("Migration token expired")

        # Create new user
        user = User(
            id=uuid4(),
            status=UserStatus.UNCLAIMED,
        )
        user = await self.user_repo.create(user)
        await self.user_repo.commit()

        # Import data
        await self._import_data(user.id, migration.payload)

        # Mark migration as claimed
        migration.claimed = True
        migration.user_id = user.id
        migration = await self.migration_repo.update(migration)
        await self.migration_repo.commit()

        # Create access token
        access_token = create_access_token(
            {"sub": str(user.id)},
            expires_delta=timedelta(days=365),
        )

        return user, access_token

    async def _import_data(self, user_id, payload: dict) -> None:
        """Import data from migration payload."""
        exercise_service = ExerciseService(self.session)
        group_service = ExerciseGroupService(self.session)
        entry_service = EntryService(self.session)

        exercises = payload.get("exercises", [])

        for exercise_data in exercises:
            # Create group if it exists
            group_id = None
            if exercise_data.get("groupId"):
                group = await group_service.create_group(
                    user_id=user_id,
                    name=f"Group {exercise_data.get('groupId')}",
                    sort_order=0,
                )
                group_id = group.id

            # Create exercise
            exercise = await exercise_service.create_exercise(
                user_id=user_id,
                name=exercise_data.get("name", "Unknown"),
                group_id=group_id,
                sort_order=exercise_data.get("order", 0),
                legacy_id=exercise_data.get("id"),
            )

            # Create entries
            for entry_data in exercise_data.get("entries", []):
                await entry_service.create_entry(
                    exercise_id=exercise.id,
                    user_id=user_id,
                    date_=entry_data.get("date"),
                    weight=entry_data.get("weight"),
                    reps=entry_data.get("reps"),
                    note=entry_data.get("note"),
                )
