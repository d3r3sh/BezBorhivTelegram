"""Auth endpoints: exchange Telegram initData for a JWT access token."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db
from typing import Optional
from backend.services.auth import validate_init_data, validate_telegram_widget
from backend.services.jwt_service import create_access_token

router = APIRouter(tags=["auth"])


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TelegramWidgetData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


def _get_or_create_user(db: Session, telegram_id: int) -> User:
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        try:
            user = User(telegram_id=telegram_id)
            db.add(user)
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.telegram_id == telegram_id).first()
    return user


@router.post("/auth/token", response_model=TokenOut)
def get_token(
    authorization: str = Header(..., description="tma <initData>"),
    db: Session = Depends(get_db),
) -> TokenOut:
    """
    Exchange Telegram Mini App initData for a JWT access token.
    Used by the web client to get a long-lived token after first auth.

    Header: Authorization: tma <url-encoded-initData>
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

    _get_or_create_user(db, telegram_id)

    return TokenOut(access_token=create_access_token(telegram_id))


@router.post("/auth/telegram-widget", response_model=TokenOut)
def telegram_widget_auth(
    data: TelegramWidgetData,
    db: Session = Depends(get_db),
) -> TokenOut:
    """
    Verify Telegram Login Widget data and return a JWT access token.
    Called by the web client after the user clicks "Увійти через Telegram".
    """
    validate_telegram_widget(data.model_dump(), settings.BOT_TOKEN, settings.AUTH_MAX_AGE)
    _get_or_create_user(db, data.id)
    return TokenOut(access_token=create_access_token(data.id))
