"""
Payment service — record, update, delete actual payments.
Single source of truth: recalculate schedule from full payment history after every change.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.loan_calculator import (
    ActualPayment as CalcActualPayment,
    annuity_payment,
    current_balance,
    payment_date_for,
    add_months,
)
from backend.db.models import Loan, Payment, User
from backend.schemas.payment import PaymentCreate, PaymentOut, PaymentUpdate


def _to_decimal(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def _get_loan_or_404(db: Session, loan_id: UUID, user_id: int) -> Loan:
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found")
    return loan


def _get_payment_or_404(db: Session, payment_id: UUID, loan_id: UUID) -> Payment:
    pmt = db.query(Payment).filter(Payment.id == payment_id, Payment.loan_id == loan_id).first()
    if not pmt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return pmt


def _compute_parts(loan: Loan, payment: Payment, all_payments: List[Payment]) -> tuple:
    """Compute principal_part and interest_part for a payment given full history."""
    # Replay history up to (but not including) this payment to get balance before
    earlier = [
        CalcActualPayment(
            id=p.id,
            actual_date=p.actual_date,
            actual_amount=_to_decimal(p.actual_amount),
            is_extra=p.is_extra,
            created_at=p.created_at,
            planned_date=p.planned_date,
            planned_amount=_to_decimal(p.planned_amount),
        )
        for p in all_payments
        if p.actual_date is not None and p.id != payment.id
    ]
    balance_before = current_balance(
        _to_decimal(loan.initial_amount),
        _to_decimal(loan.annual_rate),
        _to_decimal(loan.monthly_payment),
        earlier,
    )
    if payment.is_extra:
        return _to_decimal(payment.actual_amount), Decimal("0")

    from backend.core.loan_calculator import round2
    rate = _to_decimal(loan.annual_rate)
    if rate == Decimal("0"):
        i = Decimal("0")
    else:
        i = rate / Decimal("12") / Decimal("100")

    interest = round2(balance_before * i)
    principal = round2(_to_decimal(payment.actual_amount) - interest)
    return principal, interest


def get_payments(db: Session, loan_id: UUID, user: User) -> List[PaymentOut]:
    _get_loan_or_404(db, loan_id, user.id)
    pmts = (
        db.query(Payment)
        .filter(Payment.loan_id == loan_id)
        .order_by(Payment.created_at)
        .all()
    )
    return [PaymentOut.model_validate(p) for p in pmts]


def record_payment(
    db: Session, loan_id: UUID, data: PaymentCreate, user: User
) -> PaymentOut:
    loan = _get_loan_or_404(db, loan_id, user.id)

    pmt = Payment(
        loan_id=loan_id,
        actual_date=data.actual_date,
        actual_amount=data.actual_amount,
        is_extra=data.is_extra,
        planned_date=data.planned_date,
        planned_amount=data.planned_amount or Decimal("0"),
        created_at=datetime.utcnow(),
    )
    db.add(pmt)
    db.flush()  # get id without committing

    # Compute principal/interest parts
    all_pmts = (
        db.query(Payment).filter(Payment.loan_id == loan_id).order_by(Payment.created_at).all()
    )
    pmt.principal_part, pmt.interest_part = _compute_parts(loan, pmt, all_pmts)

    db.commit()
    db.refresh(pmt)
    return PaymentOut.model_validate(pmt)


def update_payment(
    db: Session, payment_id: UUID, loan_id: UUID, data: PaymentUpdate, user: User
) -> PaymentOut:
    loan = _get_loan_or_404(db, loan_id, user.id)
    pmt = _get_payment_or_404(db, payment_id, loan_id)

    if data.actual_date is not None:
        pmt.actual_date = data.actual_date
    if data.actual_amount is not None:
        pmt.actual_amount = data.actual_amount

    # Recompute parts with updated data
    all_pmts = (
        db.query(Payment).filter(Payment.loan_id == loan_id).order_by(Payment.created_at).all()
    )
    pmt.principal_part, pmt.interest_part = _compute_parts(loan, pmt, all_pmts)

    db.commit()
    db.refresh(pmt)
    return PaymentOut.model_validate(pmt)


def delete_payment(
    db: Session, payment_id: UUID, loan_id: UUID, user: User
) -> None:
    _get_loan_or_404(db, loan_id, user.id)
    pmt = _get_payment_or_404(db, payment_id, loan_id)
    db.delete(pmt)
    db.commit()
