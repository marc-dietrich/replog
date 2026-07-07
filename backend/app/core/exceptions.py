"""Custom application exceptions."""

from typing import Any


class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        """Initialize exception."""
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnauthorizedException(AppException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Unauthorized") -> None:
        """Initialize exception."""
        super().__init__(message, status_code=401)


class ForbiddenException(AppException):
    """Raised when user doesn't have permission."""

    def __init__(self, message: str = "Forbidden") -> None:
        """Initialize exception."""
        super().__init__(message, status_code=403)


class NotFoundException(AppException):
    """Raised when resource is not found."""

    def __init__(self, message: str = "Not Found") -> None:
        """Initialize exception."""
        super().__init__(message, status_code=404)


class ConflictException(AppException):
    """Raised when resource already exists."""

    def __init__(self, message: str = "Conflict") -> None:
        """Initialize exception."""
        super().__init__(message, status_code=409)


class ValidationException(AppException):
    """Raised when validation fails."""

    def __init__(self, message: str = "Validation Error") -> None:
        """Initialize exception."""
        super().__init__(message, status_code=422)
