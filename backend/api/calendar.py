"""
GET /api/calendar — payment events for all active loans in a date range.

Returns:
  - events: all scheduled payments (paid + future/overdue) in range
  - active_loans: loan color index list for legend

Logic per loan:
  - Paid events: actual payments (non-extra) — shown on planned_date
  - Future/overdue: computed schedule from recalculate_schedule
  No overlap: schedule starts after last paid payment date.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.core.loan_calculator import add_months
from backend.db.models import Loan as LoanModel
from backend.db.models import User
from backend.services.loan_service import get_loan, get_loans

router = APIRouter(prefix="/calendar", tags=["calendar"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CalendarEventOut(BaseModel):
    date: str             # ISO date "2026-09-15"
    loan_id: str
    loan_name: str
    color_index: int
    planned_amount: Decimal
    is_paid: bool
    is_overdue: bool


class LoanColorOut(BaseModel):
    loan_id: str
    loan_name: str
    color_index: int


class CalendarOut(BaseModel):
    events: List[CalendarEventOut]
    active_loans: List[LoanColorOut]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=CalendarOut)
def get_calendar(
    from_date: Optional[str] = Query(None, description="ISO date; default = start of current month"),
    months: int = Query(24, ge=1, le=240, description="Number of months to return"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    from_d = (
        date.fromisoformat(from_date) if from_date
        else date(today.year, today.month, 1)
    )
    to_year, to_month = add_months(from_d, months)
    to_d = date(to_year, to_month, 1)

    loans_out = get_loans(db, user, archived=False)

    events: List[CalendarEventOut] = []
    loan_colors: List[LoanColorOut] = []

    for loan_out in loans_out:
        loan_colors.append(LoanColorOut(
            loan_id=str(loan_out.id),
            loan_name=loan_out.name,
            color_index=loan_out.color_index,
        ))

        db_loan = db.query(LoanModel).filter(LoanModel.id == loan_out.id).first()
        if not db_loan:
            continue

        # 1. Paid events — use planned_date so they appear on the scheduled slot
        for pmt in (db_loan.payments or []):
            if pmt.is_extra or not pmt.planned_date or not pmt.actual_date:
                continue
            pdate: date = pmt.planned_date
            if from_d <= pdate < to_d:
                events.append(CalendarEventOut(
                    date=pdate.isoformat(),
                    loan_id=str(loan_out.id),
                    loan_name=loan_out.name,
                    color_index=loan_out.color_index,
                    planned_amount=Decimal(str(pmt.planned_amount)),
                    is_paid=True,
                    is_overdue=False,
                ))

        # 2. Future & overdue events — from computed schedule
        loan_detail = get_loan(db, loan_out.id, user)
        for sched in loan_detail.schedule:
            # ScheduledPaymentOut.date is a datetime.date object
            sdate: date = sched.date
            if from_d <= sdate < to_d:
                events.append(CalendarEventOut(
                    date=sdate.isoformat(),
                    loan_id=str(loan_out.id),
                    loan_name=loan_out.name,
                    color_index=loan_out.color_index,
                    planned_amount=sched.amount,
                    is_paid=False,
                    is_overdue=sdate < today,
                ))

    return CalendarOut(events=events, active_loans=loan_colors)
