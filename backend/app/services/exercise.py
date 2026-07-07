"""Exercise service."""

from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models import Exercise
from app.repositories.exercise import ExerciseRepository


class ExerciseService:
    """Exercise business logic."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service."""
        self.session = session
        self.repo = ExerciseRepository(session)

    async def create_exercise(
        self,
        user_id: UUID,
        name: str,
        group_id: UUID | None = None,
        sort_order: int = 0,
        legacy_id: str | None = None,
    ) -> Exercise:
        """Create exercise."""
        exercise = Exercise(
            id=uuid4(),
            user_id=user_id,
            name=name,
            group_id=group_id,
            sort_order=sort_order,
            legacy_id=legacy_id,
        )
        exercise = await self.repo.create(exercise)
        await self.repo.commit()
        return exercise

    async def get_exercise(self, exercise_id: UUID, user_id: UUID) -> Exercise:
        """Get exercise."""
        exercise = await self.repo.get_by_id_and_user(exercise_id, user_id)
        if not exercise:
            raise NotFoundException("Exercise not found")
        return exercise

    async def get_user_exercises(self, user_id: UUID) -> list[Exercise]:
        """Get all exercises for user."""
        return await self.repo.get_by_user_id(user_id)

    async def update_exercise(
        self,
        exercise_id: UUID,
        user_id: UUID,
        name: str | None = None,
        group_id: UUID | None = None,
        sort_order: int | None = None,
    ) -> Exercise:
        """Update exercise."""
        exercise = await self.get_exercise(exercise_id, user_id)
        if name is not None:
            exercise.name = name
        if group_id is not None:
            exercise.group_id = group_id
        if sort_order is not None:
            exercise.sort_order = sort_order
        exercise = await self.repo.update(exercise)
        await self.repo.commit()
        return exercise

    async def delete_exercise(self, exercise_id: UUID, user_id: UUID) -> None:
        """Delete exercise."""
        exercise = await self.get_exercise(exercise_id, user_id)
        await self.repo.delete(exercise)
        await self.repo.commit()
