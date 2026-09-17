"""
Tests for notification logic (M3).
Tests build_notifications() and format_amount() as pure functions.
Uses SQLAlchemy model instances via conftest `db` fixture.
"""

from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from backend.db.models import Loan, Payment, User
from backend.notifications.sender import build_notifications, format_amount, NotificationItem


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, telegram_id: int, **kwargs) -> User:
    defaults = dict(
        notify_day_of=True,
        notify_1_day_before=True,
        notify_3_days_before=True,
    )
    defaults.update(kwargs)
    user = User(telegram_id=telegram_id, **defaults)
    db.add(user)
    db.flush()
    return user


def _make_loan(db, user_id: int, name: str, first_payment_date: date,
               payment_day: int = None, **kwargs) -> Loan:
    if payment_day is None:
        payment_day = first_payment_date.day
    defaults = dict(
        initial_amount=Decimal("100000"),
        annual_rate=Decimal("24"),
        monthly_payment=Decimal("9455.96"),
        total_planned_payments=12,
        color_index=1,
    )
    defaults.update(kwargs)
    loan = Loan(
        user_id=user_id,
        name=name,
        first_payment_date=first_payment_date,
        payment_day=payment_day,
        **defaults,
    )
    db.add(loan)
    db.flush()
    db.refresh(loan)
    return loan


def _pay(db, loan, paid_date: date, amount: Decimal = None) -> Payment:
    """Record a regular planned payment to advance the payment schedule."""
    amount = amount or Decimal("9455.96")
    pmt = Payment(
        loan_id=loan.id,
        actual_date=paid_date,
        actual_amount=amount,
        planned_date=paid_date,
        planned_amount=amount,
        is_extra=False,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.add(pmt)
    db.flush()
    # Reload relationship
    db.refresh(loan)
    return pmt


# ---------------------------------------------------------------------------
# format_amount
# ---------------------------------------------------------------------------

class TestFormatAmount:
    def test_basic(self):
        assert format_amount(Decimal("4500.00")) == "4 500,00 ₴"

    def test_thousands(self):
        assert format_amount(Decimal("100000.00")) == "100 000,00 ₴"

    def test_millions(self):
        assert format_amount(Decimal("1000000.00")) == "1 000 000,00 ₴"

    def test_small(self):
        assert format_amount(Decimal("999.99")) == "999,99 ₴"

    def test_rounds_half_up(self):
        # 0.005 → rounds up to 0.01
        assert format_amount(Decimal("100.005")) == "100,01 ₴"

    def test_no_decimal_input(self):
        assert format_amount(Decimal("5000")) == "5 000,00 ₴"


# ---------------------------------------------------------------------------
# build_notifications — day-of
# ---------------------------------------------------------------------------

class TestDayOf:
    def test_sends_when_payment_today(self, db):
        today = date(2026, 9, 20)
        user = _make_user(db, 10001)
        loan = _make_loan(db, user.id, "Авто", today)
        db.refresh(user)

        items = build_notifications([user], today)
        assert len(items) == 1
        assert items[0].user_telegram_id == 10001
        assert "Сьогодні" in items[0].text
        assert "Авто" in items[0].text

    def test_no_send_when_notify_day_of_disabled(self, db):
        today = date(2026, 9, 20)
        user = _make_user(db, 10002, notify_day_of=False)
        _make_loan(db, user.id, "Авто", today)
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []

    def test_amount_in_message(self, db):
        today = date(2026, 9, 20)
        user = _make_user(db, 10003)
        _make_loan(db, user.id, "Авто", today, monthly_payment=Decimal("4500.00"))
        db.refresh(user)

        items = build_notifications([user], today)
        assert "4 500,00 ₴" in items[0].text


# ---------------------------------------------------------------------------
# build_notifications — 1 day before
# ---------------------------------------------------------------------------

class TestOneDayBefore:
    def test_sends_1_day_before(self, db):
        tomorrow = date(2026, 9, 21)
        today = date(2026, 9, 20)
        user = _make_user(db, 20001)
        _make_loan(db, user.id, "Кредит", tomorrow)
        db.refresh(user)

        items = build_notifications([user], today)
        assert len(items) == 1
        assert "Завтра" in items[0].text

    def test_no_send_when_disabled(self, db):
        tomorrow = date(2026, 9, 21)
        today = date(2026, 9, 20)
        user = _make_user(db, 20002, notify_1_day_before=False)
        _make_loan(db, user.id, "Кредит", tomorrow)
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []


# ---------------------------------------------------------------------------
# build_notifications — 3 days before
# ---------------------------------------------------------------------------

class TestThreeDaysBefore:
    def test_sends_3_days_before(self, db):
        in_3 = date(2026, 9, 23)
        today = date(2026, 9, 20)
        user = _make_user(db, 30001)
        _make_loan(db, user.id, "Іпотека", in_3)
        db.refresh(user)

        items = build_notifications([user], today)
        assert len(items) == 1
        assert "3 дні" in items[0].text

    def test_no_send_when_disabled(self, db):
        in_3 = date(2026, 9, 23)
        today = date(2026, 9, 20)
        user = _make_user(db, 30002, notify_3_days_before=False)
        _make_loan(db, user.id, "Іпотека", in_3)
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []


# ---------------------------------------------------------------------------
# build_notifications — overdue
# ---------------------------------------------------------------------------

class TestOverdue:
    def test_overdue_sends_regardless_of_toggle(self, db):
        yesterday = date(2026, 9, 19)
        today = date(2026, 9, 20)
        # All notification toggles OFF — overdue still sends
        user = _make_user(db, 40001,
                          notify_day_of=False,
                          notify_1_day_before=False,
                          notify_3_days_before=False)
        _make_loan(db, user.id, "Борг", yesterday)
        db.refresh(user)

        items = build_notifications([user], today)
        assert len(items) == 1
        assert "Прострочено" in items[0].text

    def test_overdue_shows_payment_date(self, db):
        payment_date = date(2026, 9, 15)
        today = date(2026, 9, 20)
        user = _make_user(db, 40002)
        _make_loan(db, user.id, "Авто", payment_date)
        db.refresh(user)

        items = build_notifications([user], today)
        assert "15.09.2026" in items[0].text


# ---------------------------------------------------------------------------
# build_notifications — edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_archived_loan_skipped(self, db):
        today = date(2026, 9, 20)
        user = _make_user(db, 50001)
        loan = _make_loan(db, user.id, "Авто", today)
        loan.is_archived = True
        db.flush()
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []

    def test_paid_off_loan_skipped(self, db):
        """A loan that is fully paid off (balance==0) must not trigger notification."""
        first = date(2026, 9, 20)
        today = date(2026, 9, 20)
        user = _make_user(db, 50002)
        # 1-payment loan — one full payment pays it off
        loan = _make_loan(
            db, user.id, "Авто", first,
            initial_amount=Decimal("9455.96"),
            total_planned_payments=1,
            monthly_payment=Decimal("9455.96"),
            annual_rate=Decimal("24"),
        )
        _pay(db, loan, first, Decimal("9455.96"))
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []

    def test_no_notification_for_2_days_before(self, db):
        """2 days before has no rule — no notification."""
        in_2 = date(2026, 9, 22)
        today = date(2026, 9, 20)
        user = _make_user(db, 50003)
        _make_loan(db, user.id, "Кредит", in_2)
        db.refresh(user)

        items = build_notifications([user], today)
        assert items == []

    def test_multiple_loans_multiple_notifications(self, db):
        today = date(2026, 9, 20)
        user = _make_user(db, 50004)
        _make_loan(db, user.id, "Авто", today)
        _make_loan(db, user.id, "Іпотека", today)
        db.refresh(user)

        items = build_notifications([user], today)
        assert len(items) == 2

    def test_next_payment_advances_after_payment_recorded(self, db):
        """
        After recording the first payment, next notification date advances.
        Loan: first payment 20.09, we record it → next is 20.10.
        Test today=20.10 → should notify.
        Test today=20.09 (original) → should NOT notify (already paid).
        """
        first = date(2026, 9, 20)
        second = date(2026, 10, 20)
        user = _make_user(db, 50005)
        loan = _make_loan(db, user.id, "Авто", first)
        _pay(db, loan, first)
        db.refresh(user)

        # After payment, today=first: no notification (next date = second)
        items_first = build_notifications([user], first)
        assert not any("Авто" in i.text and "Сьогодні" in i.text for i in items_first)

        # On second date: notification fires
        items_second = build_notifications([user], second)
        assert any("Авто" in i.text for i in items_second)

    def test_no_users_returns_empty(self):
        items = build_notifications([], date(2026, 9, 20))
        assert items == []


# ---------------------------------------------------------------------------
# Scheduler — basic setup check
# ---------------------------------------------------------------------------

def test_scheduler_has_daily_job():
    """Scheduler must have the daily_notifications job registered."""
    from unittest.mock import MagicMock
    from backend.notifications.scheduler import create_scheduler

    mock_bot = MagicMock()
    sched = create_scheduler(mock_bot)

    job_ids = [job.id for job in sched.get_jobs()]
    assert "daily_notifications" in job_ids
    # Don't start the scheduler — just verify the job was added
