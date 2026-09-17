from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.db.models import User
from backend.schemas.loan import LoanCreate, LoanDetail, LoanOut, LoanUpdate
from backend.services import loan_service

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=List[LoanOut])
def list_loans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.get_loans(db, user, archived=False)


@router.get("/archived", response_model=List[LoanOut])
def list_archived_loans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.get_loans(db, user, archived=True)


@router.post("", response_model=LoanDetail, status_code=status.HTTP_201_CREATED)
def create_loan(
    data: LoanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.create_loan(db, data, user)


@router.get("/{loan_id}", response_model=LoanDetail)
def get_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.get_loan(db, loan_id, user)


@router.put("/{loan_id}", response_model=LoanDetail)
def update_loan(
    loan_id: UUID,
    data: LoanUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.update_loan(db, loan_id, data, user)


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    loan_service.delete_loan(db, loan_id, user)


@router.post("/{loan_id}/archive", response_model=LoanOut)
def archive_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.archive_loan(db, loan_id, user)


@router.post("/{loan_id}/unarchive", response_model=LoanOut)
def unarchive_loan(
    loan_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return loan_service.unarchive_loan(db, loan_id, user)
