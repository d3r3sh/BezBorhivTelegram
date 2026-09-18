"""FastAPI dependencies: DB session + current user from Telegram initData."""

from __future__ import annotations

from typing import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db
from backend.services.auth import validate_init_data


def get_current_user(
    authorization: str = Header(..., description="tma <initData>"),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate Telegram initData from Authorization header.
    Header format: "tma <url-encoded-initData>"
    Creates user record on first access.
    """
    if not authorization.startswith("tma "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'tma '",
        )
    init_data = authorization[4:]
    user_data = validate_init_data(init_data, settings.BOT_TOKEN, settings.AUTH_MAX_AGE)

    telegram_id = user_data.get("id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user id in initData",
        )

    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        try:
            user = User(telegram_id=telegram_id)
            db.add(user)
            db.commit()
            db.refresh(user)
        except IntegrityError:
            # Race condition: another concurrent request created the user first
            db.rollback()
            user = db.query(User).filter(User.telegram_id == telegram_id).first()
    return user
