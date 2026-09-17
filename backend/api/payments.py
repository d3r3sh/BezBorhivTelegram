from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.db.models import User
from backend.schemas.payment import PaymentCreate, PaymentOut, PaymentUpdate
from backend.services import payment_service

router = APIRouter(prefix="/loans/{loan_id}/payments", tags=["payments"])


@router.get("", response_model=List[PaymentOut])
def list_payments(
    loan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return payment_service.get_payments(db, loan_id, user)


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    loan_id: UUID,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return payment_service.record_payment(db, loan_id, data, user)


@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(
    loan_id: UUID,
    payment_id: UUID,
    data: PaymentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return payment_service.update_payment(db, payment_id, loan_id, data, user)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    loan_id: UUID,
    payment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payment_service.delete_payment(db, payment_id, loan_id, user)
