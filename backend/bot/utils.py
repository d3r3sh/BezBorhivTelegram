"""Shared utilities for bot handlers."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.exc import IntegrityError

from backend.db.models import User
from backend.db.session import SessionLocal

MONTHS_UK = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
]


@contextmanager
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def run_db(telegram_id: int, fn):
    """
    Run a synchronous DB operation in a thread pool.
    Gets or creates the user by telegram_id, passes (db, user) to fn.
    """
    def _sync():
        with db_session() as db:
            user = db.query(User).filter(User.telegram_id == telegram_id).first()
            if not user:
                try:
                    user = User(telegram_id=telegram_id)
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                except IntegrityError:
                    db.rollback()
                    user = db.query(User).filter(User.telegram_id == telegram_id).first()
            return fn(db, user)
    return await asyncio.to_thread(_sync)


def parse_amount(text: str) -> Decimal | None:
    """Parse a monetary amount from user input. Returns None on failure."""
    clean = text.strip().replace(" ", "").replace("\xa0", "").replace(",", ".")
    try:
        v = Decimal(clean)
        return v if v > 0 else None
    except InvalidOperation:
        return None


def parse_rate(text: str) -> Decimal | None:
    """Parse a percentage rate (>= 0)."""
    clean = text.strip().replace(",", ".")
    try:
        v = Decimal(clean)
        return v if v >= 0 else None
    except InvalidOperation:
        return None


def parse_date(text: str) -> date | None:
    """Accept DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD."""
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def fmt_amount(v) -> str:
    """Format as '12 500,00 ₴'."""
    d = Decimal(str(v)).quantize(Decimal("0.01"))
    int_part, dec_part = str(d).split(".")
    int_formatted = f"{int(int_part):,}".replace(",", " ")
    return f"{int_formatted},{dec_part} ₴"


def fmt_date(d: date) -> str:
    """Format as '15 жовтня 2026'."""
    return f"{d.day} {MONTHS_UK[d.month - 1]} {d.year}"
