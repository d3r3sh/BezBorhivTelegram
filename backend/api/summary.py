from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.db.models import User
from backend.services.loan_service import get_loans

router = APIRouter(prefix="/summary", tags=["summary"])


class SummaryOut(BaseModel):
    active_loan_count: int
    total_debt: Decimal           # sum of total_debt (body + remaining interest)
    total_body: Decimal           # sum of current_balance (principal only)
    min_monthly: Decimal          # sum of monthly_payment
    recommended_monthly: Optional[Decimal]   # = budget when strategy set & budget > min
    remaining_this_month: Decimal # loans due this month or overdue
    strategy: str


@router.get("", response_model=SummaryOut)
def get_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loans = get_loans(db, user, archived=False)
    today = date.today()

    total_debt = sum((l.total_debt for l in loans), Decimal("0"))
    total_body = sum((l.current_balance for l in loans), Decimal("0"))
    min_monthly = sum((l.monthly_payment for l in loans), Decimal("0"))

    # Remaining this month: payments due this month or overdue (not yet paid off)
    remaining = Decimal("0")
    for loan in loans:
        npd = loan.next_payment_date
        if npd is None:
            continue
        if npd.year < today.year or (npd.year == today.year and npd.month <= today.month):
            remaining += loan.next_payment_amount or Decimal(str(loan.monthly_payment))

    # Recommended = budget when strategy is set and budget exceeds minimum
    recommended: Optional[Decimal] = None
    if user.strategy != "none" and user.monthly_budget is not None:
        budget = Decimal(str(user.monthly_budget))
        if budget > min_monthly:
            recommended = budget

    return SummaryOut(
        active_loan_count=len(loans),
        total_debt=total_debt,
        total_body=total_body,
        min_monthly=min_monthly,
        recommended_monthly=recommended,
        remaining_this_month=remaining,
        strategy=user.strategy,
    )
