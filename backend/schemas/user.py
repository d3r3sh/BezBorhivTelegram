from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    monthly_budget: Optional[Decimal] = None
    strategy: str
    notify_day_of: bool
    notify_1_day_before: bool
    notify_3_days_before: bool
