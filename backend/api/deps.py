"""FastAPI dependencies: DB session + current user.

Supports two Authorization schemes:
  tma <initData>   — Telegram Mini App (existing flow)
  Bearer <jwt>     — Web client JWT (new flow)
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import User
from backend.db.session import get_db
from backend.services.auth import validate_init_data
from backend.services.jwt_service import verify_access_token


def get_current_user(
    authorization: str = Header(..., description="tma <initData> or Bearer <jwt>"),
    db: Session = Depends(get_db),
) -> User:
    # ── Mini App: tma <initData> ──────────────────────────────────────────────
    if authorization.startswith("tma "):
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
                db.rollback()
                user = db.query(User).filter(User.telegram_id == telegram_id).first()
        return user

    # ── Web: Bearer <jwt> ─────────────────────────────────────────────────────
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        telegram_id = verify_access_token(token)

        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authorization header must start with 'tma ' or 'Bearer '",
    )
