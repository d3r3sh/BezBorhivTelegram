"""
Loan service — business logic layer.
Calls loan_calculator for all math; never does arithmetic directly.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.loan_calculator import (
    ActualPayment,
    ScheduledPayment,
    add_months,
    annuity_payment,
    calculate_irr,
    current_balance,
    generate_schedule,
    payment_date_for,
    recalculate_schedule,
    InsufficientPaymentError,
)
from backend.db.models import Loan, Payment, User
from backend.schemas.loan import LoanCreate, LoanDetail, LoanOut, LoanUpdate, ScheduledPaymentOut


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_decimal(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def _actuals_from_payments(payments: List[Payment]) -> List[ActualPayment]:
    return [
        ActualPayment(
            id=p.id,
            actual_date=p.actual_date,
            actual_amount=_to_decimal(p.actual_amount),
            is_extra=p.is_extra,
            created_at=p.created_at,
            planned_date=p.planned_date,
            planned_amount=_to_decimal(p.planned_amount),
        )
        for p in (payments or [])
        if p.actual_date is not None
    ]


def _compute(loan: Loan, today: Optional[date] = None) -> dict:
    """Compute all derived fields for a loan response."""
    today = today or date.today()
    actuals = _actuals_from_payments(loan.payments or [])

    balance = current_balance(
        _to_decimal(loan.initial_amount),
        _to_decimal(loan.annual_rate),
        _to_decimal(loan.monthly_payment),
        actuals,
    )

    # Next payment date: first_payment_date + number_of_regular_payments months
    paid_count = sum(1 for p in (loan.payments or []) if not p.is_extra)
    year, month = add_months(loan.first_payment_date, paid_count)
    next_date = payment_date_for(year, month, loan.payment_day)

    if balance <= Decimal("0"):
        sched = []
    elif not actuals:
        # No actual payments yet: use original n directly.
        sched = generate_schedule(
            _to_decimal(loan.initial_amount),
            _to_decimal(loan.annual_rate),
            _to_decimal(loan.monthly_payment),
            loan.total_planned_payments,
            loan.first_payment_date,
            loan.payment_day,
        )
    else:
        raw = recalculate_schedule(
            _to_decimal(loan.initial_amount),
            _to_decimal(loan.annual_rate),
            _to_decimal(loan.monthly_payment),
            loan.payment_day,
            actuals,
            next_date,
        )
        # _count_remaining_payments may return expected+1 due to SRS 4.2
        # rounding artefact (standard payment leaves ≤0.01 residual instead
        # of exactly 0). Correct by regenerating with the expected count if
        # recalculate returned exactly one extra and the original term is known.
        expected_remaining = max(0, loan.total_planned_payments - paid_count)
        if expected_remaining > 0 and len(raw) == expected_remaining + 1:
            sched = generate_schedule(
                balance,
                _to_decimal(loan.annual_rate),
                _to_decimal(loan.monthly_payment),
                expected_remaining,
                next_date,
                loan.payment_day,
            )
        else:
            sched = raw

    total_debt = sum((p.amount for p in sched), Decimal("0"))
    nxt_date = sched[0].date if sched else None
    nxt_amount = sched[0].amount if sched else None
    is_overdue = nxt_date is not None and nxt_date < today

    return {
        "current_balance": balance,
        "total_debt": total_debt,
        "next_payment_date": nxt_date,
        "next_payment_amount": nxt_amount,
        "payments_made": paid_count,
        "payments_remaining": len(sched),
        "is_overdue": is_overdue,
        "schedule": sched,
    }


def _to_out(loan: Loan, include_schedule: bool = False) -> dict:
    c = _compute(loan)
    d = {
        "id": loan.id,
        "name": loan.name,
        "initial_amount": _to_decimal(loan.initial_amount),
        "annual_rate": _to_decimal(loan.annual_rate),
        "monthly_payment": _to_decimal(loan.monthly_payment),
        "total_planned_payments": loan.total_planned_payments,
        "first_payment_date": loan.first_payment_date,
        "payment_day": loan.payment_day,
        "color_index": loan.color_index,
        "is_archived": loan.is_archived,
        "archived_at": loan.archived_at,
        "created_at": loan.created_at,
        **{k: v for k, v in c.items() if k != "schedule"},
    }
    if include_schedule:
        d["schedule"] = [
            ScheduledPaymentOut(
                number=s.number, date=s.date, amount=s.amount,
                principal=s.principal, interest=s.interest, balance=s.balance,
            )
            for s in c["schedule"]
        ]
    return d


def _next_color_index(db: Session, user_id: int) -> int:
    """Assign color_index: max(existing active) + 1, cycling 1–10."""
    from sqlalchemy import func
    max_idx = (
        db.query(func.max(Loan.color_index))
        .filter(Loan.user_id == user_id, Loan.is_archived.is_(False))
        .scalar()
    ) or 0
    result = (max_idx % 10) + 1
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_loans(db: Session, user: User, archived: bool = False) -> List[LoanOut]:
    loans = (
        db.query(Loan)
        .filter(Loan.user_id == user.id, Loan.is_archived.is_(archived))
        .all()
    )
    result = [LoanOut(**_to_out(loan)) for loan in loans]
    # FR-MAIN-2: sort by next_payment_date ascending (overdue first, nulls last)
    result.sort(key=lambda l: (
        l.next_payment_date is None,
        l.next_payment_date or date.max,
    ))
    return result


def get_loan(db: Session, loan_id: UUID, user: User) -> LoanDetail:
    loan = _get_or_404(db, loan_id, user.id)
    return LoanDetail(**_to_out(loan, include_schedule=True))


def create_loan(db: Session, data: LoanCreate, user: User) -> LoanDetail:
    annual_rate, monthly_payment = _resolve_rate_and_payment(data)

    color = data.color_index or _next_color_index(db, user.id)

    loan = Loan(
        user_id=user.id,
        name=data.name,
        initial_amount=annual_rate and data.initial_amount or data.initial_amount,
        annual_rate=annual_rate,
        monthly_payment=monthly_payment,
        total_planned_payments=data.total_planned_payments,
        first_payment_date=data.first_payment_date,
        payment_day=data.first_payment_date.day,
        color_index=color,
    )
    # Set initial_amount explicitly (avoid re-evaluation in expression above)
    loan.initial_amount = data.initial_amount

    db.add(loan)
    db.commit()
    db.refresh(loan)
    return LoanDetail(**_to_out(loan, include_schedule=True))


def update_loan(db: Session, loan_id: UUID, data: LoanUpdate, user: User) -> LoanDetail:
    loan = _get_or_404(db, loan_id, user.id)

    # Build a temporary LoanCreate-like object for rate/payment resolution
    if data.name is not None:
        loan.name = data.name
    if data.color_index is not None:
        loan.color_index = data.color_index

    # If financial parameters changed, recalculate rate/payment
    financial_changed = any(
        v is not None for v in [
            data.initial_amount, data.total_planned_payments,
            data.input_mode, data.annual_rate, data.monthly_payment,
            data.first_payment_date,
        ]
    )
    if financial_changed:
        new_initial = data.initial_amount or _to_decimal(loan.initial_amount)
        new_n = data.total_planned_payments or loan.total_planned_payments
        new_mode = data.input_mode or ("rate" if _to_decimal(loan.annual_rate) >= 0 else "payment")
        new_rate = data.annual_rate
        new_payment = data.monthly_payment

        if new_mode == "rate":
            rate = new_rate if new_rate is not None else _to_decimal(loan.annual_rate)
            payment = annuity_payment(new_initial, rate, new_n)
        else:
            payment = new_payment if new_payment is not None else _to_decimal(loan.monthly_payment)
            try:
                rate = calculate_irr(new_initial, new_n, payment)
            except InsufficientPaymentError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="monthly_payment * total_planned_payments must be >= initial_amount",
                )

        loan.initial_amount = new_initial
        loan.annual_rate = rate
        loan.monthly_payment = payment
        loan.total_planned_payments = new_n
        if data.first_payment_date:
            loan.first_payment_date = data.first_payment_date
            loan.payment_day = data.first_payment_date.day

    db.commit()
    db.refresh(loan)
    return LoanDetail(**_to_out(loan, include_schedule=True))


def delete_loan(db: Session, loan_id: UUID, user: User) -> None:
    loan = _get_or_404(db, loan_id, user.id)
    db.delete(loan)
    db.commit()


def archive_loan(db: Session, loan_id: UUID, user: User) -> LoanOut:
    loan = _get_or_404(db, loan_id, user.id)
    if loan.is_archived:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Loan already archived")
    loan.is_archived = True
    loan.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(loan)
    return LoanOut(**_to_out(loan))


def unarchive_loan(db: Session, loan_id: UUID, user: User) -> LoanOut:
    loan = _get_or_404(db, loan_id, user.id)
    if not loan.is_archived:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Loan is not archived")
    loan.is_archived = False
    loan.archived_at = None
    db.commit()
    db.refresh(loan)
    return LoanOut(**_to_out(loan))


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _resolve_rate_and_payment(data: LoanCreate):
    """Return (annual_rate, monthly_payment) based on input_mode."""
    if data.input_mode == "rate":
        if data.annual_rate is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="annual_rate is required for input_mode=rate",
            )
        rate = data.annual_rate
        payment = annuity_payment(data.initial_amount, rate, data.total_planned_payments)
    else:
        if data.monthly_payment is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="monthly_payment is required for input_mode=payment",
            )
        payment = data.monthly_payment
        try:
            rate = calculate_irr(data.initial_amount, data.total_planned_payments, payment)
        except InsufficientPaymentError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="monthly_payment * total_planned_payments must be >= initial_amount",
            )
    return rate, payment


def _get_or_404(db: Session, loan_id: UUID, user_id: int) -> Loan:
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
    return loan
