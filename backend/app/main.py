"""Main FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, entries, exercises, groups, migrations
from app.core.config import settings
from app.core.exceptions import AppException
from app.db import engine
from app.db.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database initialized")
    yield
    # Shutdown
    await engine.dispose()
    print("✅ Application shutdown")


def create_app() -> FastAPI:
    """Create FastAPI application."""
    app = FastAPI(
        title="Gym Tracker API",
        description="Backend API for Gym Tracking Application",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    @app.exception_handler(AppException)
    async def app_exception_handler(request, exc: AppException):
        return HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )

    # Include routers
    app.include_router(auth.router, prefix=settings.API_PREFIX)
    app.include_router(migrations.router, prefix=settings.API_PREFIX)
    app.include_router(groups.router, prefix=settings.API_PREFIX)
    app.include_router(exercises.router, prefix=settings.API_PREFIX)
    app.include_router(entries.router, prefix=settings.API_PREFIX)

    # Health check
    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    @app.get("/")
    async def root():
        return {"message": "Gym Tracker API", "version": "0.1.0"}

    return app


app = create_app()
