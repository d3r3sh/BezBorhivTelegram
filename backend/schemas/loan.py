from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Scheduled payment (computed, not stored)
# ---------------------------------------------------------------------------

class ScheduledPaymentOut(BaseModel):
    number: int
    date: date
    amount: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal


# ---------------------------------------------------------------------------
# Loan create / update
# ---------------------------------------------------------------------------

class LoanCreate(BaseModel):
    name: str
    is_already_paying: bool = False
    initial_amount: Decimal
    total_planned_payments: int
    input_mode: Literal["rate", "payment"]
    annual_rate: Optional[Decimal] = None      # required when input_mode == "rate"
    monthly_payment: Optional[Decimal] = None  # required when input_mode == "payment"
    first_payment_date: date
    color_index: Optional[int] = None          # auto-assigned if None

    @field_validator("initial_amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("initial_amount must be > 0")
        return v

    @field_validator("total_planned_payments")
    @classmethod
    def payments_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("total_planned_payments must be > 0")
        return v


class LoanUpdate(BaseModel):
    name: Optional[str] = None
    initial_amount: Optional[Decimal] = None
    total_planned_payments: Optional[int] = None
    input_mode: Optional[Literal["rate", "payment"]] = None
    annual_rate: Optional[Decimal] = None
    monthly_payment: Optional[Decimal] = None
    first_payment_date: Optional[date] = None
    color_index: Optional[int] = None


# ---------------------------------------------------------------------------
# Loan responses
# ---------------------------------------------------------------------------

class LoanOut(BaseModel):
    """Loan summary — used in list views."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    initial_amount: Decimal
    annual_rate: Decimal
    monthly_payment: Decimal
    total_planned_payments: int
    first_payment_date: date
    payment_day: int
    color_index: int
    is_archived: bool
    archived_at: Optional[datetime]
    created_at: datetime

    # Computed fields
    current_balance: Decimal
    total_debt: Decimal
    next_payment_date: Optional[date]
    next_payment_amount: Optional[Decimal]
    payments_made: int
    payments_remaining: int
    is_overdue: bool


class LoanDetail(LoanOut):
    """Loan detail — includes full schedule and payments."""
    schedule: List[ScheduledPaymentOut]
