from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class PaymentCreate(BaseModel):
    actual_date: date
    actual_amount: Decimal
    is_extra: bool = False
    planned_date: Optional[date] = None
    planned_amount: Optional[Decimal] = None

    @field_validator("actual_amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("actual_amount must be > 0")
        return v


class PaymentUpdate(BaseModel):
    actual_date: Optional[date] = None
    actual_amount: Optional[Decimal] = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    loan_id: uuid.UUID
    planned_date: Optional[date]
    planned_amount: Decimal
    actual_date: Optional[date]
    actual_amount: Decimal
    is_extra: bool
    principal_part: Decimal
    interest_part: Decimal
    created_at: datetime
