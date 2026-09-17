from __future__ import annotations

from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.db.models import User
from backend.schemas.user import UserOut

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    monthly_budget: Optional[Decimal] = None
    strategy: Optional[Literal["none", "avalanche", "snowball"]] = None
    notify_day_of: Optional[bool] = None
    notify_1_day_before: Optional[bool] = None
    notify_3_days_before: Optional[bool] = None


@router.get("", response_model=UserOut)
def get_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user


@router.put("", response_model=UserOut)
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.monthly_budget is not None:
        user.monthly_budget = data.monthly_budget
    if data.strategy is not None:
        user.strategy = data.strategy
    if data.notify_day_of is not None:
        user.notify_day_of = data.notify_day_of
    if data.notify_1_day_before is not None:
        user.notify_1_day_before = data.notify_1_day_before
    if data.notify_3_days_before is not None:
        user.notify_3_days_before = data.notify_3_days_before
    db.commit()
    db.refresh(user)
    return user
