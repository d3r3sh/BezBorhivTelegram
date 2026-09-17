"""
Notification logic — pure functions, no DB or bot dependencies.
Determines which messages to send and formats their text.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import List, Optional

from backend.core.loan_calculator import (
    ActualPayment,
    add_months,
    current_balance,
    payment_date_for,
    round2,
)


# ---------------------------------------------------------------------------
# Amount formatting  (SRS format: «4 500,00 ₴» with non-breaking space)
# ---------------------------------------------------------------------------

_NBSP = " "


def format_amount(amount: Decimal) -> str:
    """Format Decimal as '4 500,00 ₴' (non-breaking space, comma decimal)."""
    rounded = round2(amount)
    s = str(rounded)
    if "." in s:
        int_part, dec_part = s.split(".")
        dec_part = dec_part.ljust(2, "0")[:2]
    else:
        int_part, dec_part = s, "00"

    # Insert non-breaking space every 3 digits from the right
    int_val = int(int_part)
    formatted_int = f"{int_val:,}".replace(",", _NBSP)

    return f"{formatted_int},{dec_part} ₴"


# ---------------------------------------------------------------------------
# Notification data class
# ---------------------------------------------------------------------------

@dataclass
class NotificationItem:
    user_telegram_id: int
    text: str


# ---------------------------------------------------------------------------
# Loan helpers (duck-typed — work with SQLAlchemy models or plain objects)
# ---------------------------------------------------------------------------

def _to_decimal(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def _actuals(payments) -> List[ActualPayment]:
    from datetime import datetime
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


def _next_payment_date(loan) -> Optional[date]:
    paid_count = sum(1 for p in (loan.payments or []) if not p.is_extra)
    year, month = add_months(loan.first_payment_date, paid_count)
    return payment_date_for(year, month, loan.payment_day)


def _is_paid_off(loan) -> bool:
    actuals = _actuals(loan.payments)
    balance = current_balance(
        _to_decimal(loan.initial_amount),
        _to_decimal(loan.annual_rate),
        _to_decimal(loan.monthly_payment),
        actuals,
    )
    return balance <= Decimal("0")


# ---------------------------------------------------------------------------
# Core: build notification list for today
# ---------------------------------------------------------------------------

def build_notifications(users, today: date) -> List[NotificationItem]:
    """
    Pure function. Returns list of NotificationItem to send today.
    Works with any objects that have the expected attributes.

    Notification rules (SRS FR-NOTIF-1..4, Telegram context doc):
      - next_payment < today          → overdue daily reminder (always)
      - next_payment == today         → day-of (if notify_day_of)
      - next_payment == today+1       → 1-day-before (if notify_1_day_before)
      - next_payment == today+3       → 3-days-before (if notify_3_days_before)
    """
    items: List[NotificationItem] = []

    for user in users:
        for loan in (user.loans or []):
            if loan.is_archived:
                continue
            if _is_paid_off(loan):
                continue

            npd = _next_payment_date(loan)
            if npd is None:
                continue

            days_until = (npd - today).days
            amount_str = format_amount(_to_decimal(loan.monthly_payment))

            if days_until < 0:
                # Overdue — sent every day regardless of toggle
                text = (
                    f"⚠️ Прострочено: платіж {amount_str} — "
                    f"«{loan.name}»\n"
                    f"Дата платежу: {npd.strftime('%d.%m.%Y')}"
                )
                items.append(NotificationItem(user.telegram_id, text))

            elif days_until == 0 and user.notify_day_of:
                text = f"💳 Сьогодні платіж {amount_str} — «{loan.name}»"
                items.append(NotificationItem(user.telegram_id, text))

            elif days_until == 1 and user.notify_1_day_before:
                text = f"🔔 Завтра платіж {amount_str} — «{loan.name}»"
                items.append(NotificationItem(user.telegram_id, text))

            elif days_until == 3 and user.notify_3_days_before:
                text = (
                    f"📅 Через 3 дні платіж {amount_str} — «{loan.name}»"
                )
                items.append(NotificationItem(user.telegram_id, text))

    return items
