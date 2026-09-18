"""JWT token creation and verification for web auth."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from fastapi import HTTPException, status

from backend.config import settings


def create_access_token(telegram_id: int) -> str:
    """Issue a signed JWT for the given Telegram user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(telegram_id),
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_access_token(token: str) -> int:
    """
    Validate JWT signature and expiry.
    Returns telegram_id on success.
    Raises HTTP 401 on invalid or expired token.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return int(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
