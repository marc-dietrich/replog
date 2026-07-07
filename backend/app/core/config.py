"""Application configuration settings."""

from typing import Any

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str
    DATABASE_ECHO: bool = False

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Server
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    API_VERSION: str = "v1"
    API_PREFIX: str = "/api"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Migration
    MIGRATION_TOKEN_EXPIRY_DAYS: int = 7

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True

    def get_database_url(self) -> str:
        """Get database connection string."""
        return self.DATABASE_URL


settings = Settings()
