"""Auth API routes."""

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas import GuestAuthResponse, CurrentUserResponse, UserResponse
from app.services.user import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/guest", response_model=GuestAuthResponse)
async def create_guest_auth(session: AsyncSession = Depends(get_session)) -> GuestAuthResponse:
    """Create guest user and return access token."""
    service = UserService(session)
    user, token = await service.create_guest_user()
    return GuestAuthResponse(access_token=token, user_id=user.id)


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    """Get current user information."""
    return CurrentUserResponse(
        user=UserResponse(
            id=current_user.id,
            email=current_user.email,
            display_name=current_user.display_name,
            status=current_user.status.value,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
        )
    )
