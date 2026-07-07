"""User service."""

from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token
from app.core.exceptions import ConflictException, NotFoundException
from app.models import User, UserStatus
from app.repositories.user import UserRepository


class UserService:
    """User business logic."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize service."""
        self.session = session
        self.repo = UserRepository(session)

    async def create_guest_user(self) -> tuple[User, str]:
        """Create guest user and return access token."""
        user = User(
            id=uuid4(),
            status=UserStatus.UNCLAIMED,
        )
        user = await self.repo.create(user)
        await self.repo.commit()

        access_token = create_access_token(
            {"sub": str(user.id)},
            expires_delta=timedelta(
                days=365
            ),  # Guest users get long-lived tokens
        )
        return user, access_token

    async def get_user_by_id(self, user_id: UUID) -> User:
        """Get user by ID."""
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        return user

    async def create_or_update_unclaimed_user(
        self, email: str | None = None, display_name: str | None = None
    ) -> User:
        """Create or update unclaimed user."""
        user = User(
            id=uuid4(),
            email=email,
            display_name=display_name,
            status=UserStatus.UNCLAIMED,
        )
        user = await self.repo.create(user)
        await self.repo.commit()
        return user

    async def activate_user(
        self, user_id: UUID, email: str | None = None
    ) -> User:
        """Activate user."""
        user = await self.get_user_by_id(user_id)
        user.status = UserStatus.ACTIVE
        if email:
            existing = await self.repo.get_by_email(email)
            if existing and existing.id != user_id:
                raise ConflictException("Email already exists")
            user.email = email
        user = await self.repo.update(user)
        await self.repo.commit()
        return user

    async def update_user(
        self, user_id: UUID, display_name: str | None = None
    ) -> User:
        """Update user."""
        user = await self.get_user_by_id(user_id)
        if display_name is not None:
            user.display_name = display_name
        user = await self.repo.update(user)
        await self.repo.commit()
        return user
