"""Migration API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import MigrationInitiate, MigrationInitiateResponse, MigrationClaim, MigrationClaimResponse
from app.services.migration import MigrationService

router = APIRouter(prefix="/migrations", tags=["migrations"])


@router.post("", response_model=MigrationInitiateResponse)
async def initiate_migration(
    request: MigrationInitiate,
    session: AsyncSession = Depends(get_session),
) -> MigrationInitiateResponse:
    """Initiate data migration from old system."""
    service = MigrationService(session)
    token, redirect_url = await service.initiate_migration(request.dict())
    return MigrationInitiateResponse(migration_token=token, redirect_url=redirect_url)


@router.post("/claim", response_model=MigrationClaimResponse)
async def claim_migration(
    request: MigrationClaim,
    session: AsyncSession = Depends(get_session),
) -> MigrationClaimResponse:
    """Claim migration and create user account."""
    service = MigrationService(session)
    user, token = await service.claim_migration(request.migration_token)

    from app.schemas import UserResponse

    return MigrationClaimResponse(
        access_token=token,
        user_id=user.id,
        user=UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            status=user.status.value,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ),
    )
