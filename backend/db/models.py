"""
SQLAlchemy ORM models — matches the data model from the context document.
Uses a custom GUID TypeDecorator so the same code runs on PostgreSQL (native UUID)
and SQLite (VARCHAR 36) without changes.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.types import TypeDecorator


# ---------------------------------------------------------------------------
# GUID type: native UUID on PostgreSQL, VARCHAR(36) on SQLite
# ---------------------------------------------------------------------------

class GUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID
            return dialect.type_descriptor(UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value) if isinstance(value, uuid.UUID) else str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    monthly_budget = Column(Numeric(14, 2), nullable=True)
    strategy = Column(String(20), nullable=False, default="none")
    notify_day_of = Column(Boolean, nullable=False, default=True)
    notify_1_day_before = Column(Boolean, nullable=False, default=True)
    notify_3_days_before = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Loan
# ---------------------------------------------------------------------------

class Loan(Base):
    __tablename__ = "loans"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    initial_amount = Column(Numeric(14, 2), nullable=False)
    annual_rate = Column(Numeric(10, 4), nullable=False)
    monthly_payment = Column(Numeric(14, 2), nullable=False)
    total_planned_payments = Column(Integer, nullable=False)
    first_payment_date = Column(Date, nullable=False)
    payment_day = Column(Integer, nullable=False)        # 1–31
    color_index = Column(Integer, nullable=False, default=1)
    is_archived = Column(Boolean, nullable=False, default=False)
    archived_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="loans")
    payments = relationship(
        "Payment",
        back_populates="loan",
        cascade="all, delete-orphan",
        order_by="Payment.created_at",
    )


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------

class Payment(Base):
    __tablename__ = "payments"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    loan_id = Column(GUID, ForeignKey("loans.id"), nullable=False, index=True)
    planned_date = Column(Date, nullable=True)
    planned_amount = Column(Numeric(14, 2), nullable=False, default=0)
    actual_date = Column(Date, nullable=True)
    actual_amount = Column(Numeric(14, 2), nullable=False, default=0)
    is_extra = Column(Boolean, nullable=False, default=False)
    principal_part = Column(Numeric(14, 2), nullable=False, default=0)
    interest_part = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    loan = relationship("Loan", back_populates="payments")
