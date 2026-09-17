"""
Loan calculation core — SRS sections 4.1–4.7.
All monetary arithmetic uses Decimal with ROUND_HALF_UP to 2 places.
No database or UI dependencies.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional
from uuid import UUID


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class LoanCalculatorError(Exception):
    pass


class InsufficientPaymentError(LoanCalculatorError):
    """monthly_payment * n < principal — no solution exists (SRS 4.3)."""


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ScheduledPayment:
    number: int
    date: date
    amount: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal


@dataclass
class ActualPayment:
    id: UUID
    actual_date: date
    actual_amount: Decimal
    is_extra: bool
    created_at: datetime
    planned_date: Optional[date] = None
    planned_amount: Decimal = field(default_factory=lambda: Decimal("0"))


@dataclass
class LoanSnapshot:
    id: UUID
    remaining_balance: Decimal
    annual_rate: Decimal      # e.g. Decimal("24") means 24% per year
    monthly_payment: Decimal  # mandatory monthly payment
    name: str = ""            # optional display name for recommendations


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TWO = Decimal("0.01")


def round2(value: Decimal) -> Decimal:
    """Round to 2 decimal places using ROUND_HALF_UP."""
    return value.quantize(_TWO, rounding=ROUND_HALF_UP)


def payment_date_for(year: int, month: int, payment_day: int) -> date:
    """
    SRS 4.5: Return the actual payment date for (year, month) with clamping.
    If payment_day > days in month → last day of that month.
    payment_day itself is NOT modified.
    """
    days_in_month = calendar.monthrange(year, month)[1]
    actual_day = min(payment_day, days_in_month)
    return date(year, month, actual_day)


def _add_months(d: date, months: int) -> tuple[int, int]:
    """Return (year, month) after adding `months` to date d."""
    total = d.month - 1 + months
    return d.year + total // 12, total % 12 + 1


def add_months(d: date, months: int) -> tuple[int, int]:
    """Public alias for _add_months. Returns (year, month)."""
    return _add_months(d, months)


# ---------------------------------------------------------------------------
# SRS 4.1 — Annuity payment
# ---------------------------------------------------------------------------

def annuity_payment(
    principal: Decimal,
    annual_rate: Decimal,
    n: int,
) -> Decimal:
    """
    SRS 4.1.
    rate == 0 → A = principal / n
    rate > 0 → A = S * i / (1 - (1+i)^(-n)), i = annual_rate / 12 / 100
    """
    if annual_rate == Decimal("0"):
        return round2(principal / Decimal(n))

    i = annual_rate / Decimal("12") / Decimal("100")
    factor = (Decimal("1") + i) ** n
    a = principal * i * factor / (factor - Decimal("1"))
    return round2(a)


# ---------------------------------------------------------------------------
# SRS 4.1 + 4.2 + 4.5 — Schedule generation
# ---------------------------------------------------------------------------

def generate_schedule(
    principal: Decimal,
    annual_rate: Decimal,
    monthly_payment: Decimal,
    n: int,
    first_payment_date: date,
    payment_day: int,
) -> list[ScheduledPayment]:
    """
    SRS 4.1, 4.2, 4.5.
    Payment 1  : first_payment_date (as-is).
    Payment k>1: payment_date_for using payment_day with clamping.
    Last payment (SRS 4.2): adjusted so remaining balance == 0.00 exactly.
    """
    if annual_rate == Decimal("0"):
        i = Decimal("0")
    else:
        i = annual_rate / Decimal("12") / Decimal("100")

    schedule: list[ScheduledPayment] = []
    balance = principal

    for k in range(1, n + 1):
        # Date
        if k == 1:
            pdate = first_payment_date
        else:
            year, month = _add_months(first_payment_date, k - 1)
            pdate = payment_date_for(year, month, payment_day)

        # Interest and principal
        interest = round2(balance * i)

        if k == n:
            # SRS 4.2: last payment closes the balance exactly
            amount = round2(balance + interest)
            principal_part = balance
        else:
            amount = monthly_payment
            principal_part = round2(amount - interest)

        balance = round2(balance - principal_part)
        # Guard against floating-point drift on last payment
        if k == n:
            balance = Decimal("0")

        schedule.append(ScheduledPayment(
            number=k,
            date=pdate,
            amount=amount,
            principal=principal_part,
            interest=interest,
            balance=balance,
        ))

    return schedule


# ---------------------------------------------------------------------------
# SRS 4.3 — IRR (find annual rate from known payment)
# ---------------------------------------------------------------------------

def calculate_irr(
    principal: Decimal,
    n: int,
    monthly_payment: Decimal,
) -> Decimal:
    """
    SRS 4.3. Bisection for monthly rate i.
    Tolerance for 0% check: |monthly_payment * n - principal| <= n * 0.01
    Raises InsufficientPaymentError if monthly_payment * n < principal.
    Returns annual rate as Decimal, e.g. Decimal("22.25").
    Accuracy: 0.0001% annual = 0.000001/12 monthly.
    """
    total = monthly_payment * Decimal(n)
    diff = total - principal
    tolerance = Decimal(n) * Decimal("0.01")

    if diff < Decimal("0"):
        raise InsufficientPaymentError(
            f"monthly_payment * n ({total}) < principal ({principal})"
        )
    if diff <= tolerance:
        return Decimal("0")

    # Bisection: find monthly i in (0, 10) such that annuity(principal, i, n) == monthly_payment
    # Use float internally for bisection bounds, then refine with Decimal
    lo = Decimal("0.000001")
    hi = Decimal("10")          # 1000% monthly — effectively infinite upper bound

    target = monthly_payment

    for _ in range(200):        # 200 iterations → precision < 1e-60
        mid = (lo + hi) / Decimal("2")
        factor = (Decimal("1") + mid) ** n
        a = principal * mid * factor / (factor - Decimal("1"))
        a = round2(a)
        if a == target:
            break
        elif a > target:
            hi = mid
        else:
            lo = mid

    annual = mid * Decimal("12") * Decimal("100")
    # Round to 4 decimal places for the rate (0.0001% precision)
    annual = annual.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return annual


# ---------------------------------------------------------------------------
# SRS 4.4 — Current balance from actual payment history
# ---------------------------------------------------------------------------

def current_balance(
    initial_amount: Decimal,
    annual_rate: Decimal,
    monthly_payment: Decimal,
    actual_payments: list[ActualPayment],
) -> Decimal:
    """
    SRS 4.4. Replay actual payment history from initial_amount.
    Sort by (actual_date, created_at) for deterministic ordering.
    - Regular payment: interest = balance * i; principal = actual_amount - interest.
    - Extra payment (is_extra=True): full amount reduces principal.
    Returns current remaining balance (>= 0).
    """
    if annual_rate == Decimal("0"):
        i = Decimal("0")
    else:
        i = annual_rate / Decimal("12") / Decimal("100")

    balance = initial_amount
    sorted_payments = sorted(actual_payments, key=lambda p: (p.actual_date, p.created_at))

    for pmt in sorted_payments:
        if balance <= Decimal("0"):
            break

        if pmt.is_extra:
            balance = max(Decimal("0"), round2(balance - pmt.actual_amount))
        else:
            interest = round2(balance * i)
            principal_paid = round2(pmt.actual_amount - interest)
            balance = max(Decimal("0"), round2(balance - principal_paid))

    return balance


# ---------------------------------------------------------------------------
# SRS 4.4 — Recalculate future schedule
# ---------------------------------------------------------------------------

def _count_remaining_payments(
    balance: Decimal,
    annual_rate: Decimal,
    monthly_payment: Decimal,
) -> int:
    """
    Iteratively count how many full payments of monthly_payment are needed
    to bring balance to 0. Returns at least 1.
    Uses Decimal arithmetic — correctly handles boundary cases (TC-CALC-07c).
    """
    if balance <= Decimal("0"):
        return 0

    if annual_rate == Decimal("0"):
        # Simple division, ceil
        full = balance / monthly_payment
        n = int(full)
        if round2(full) > Decimal(n):
            n += 1
        return max(1, n)

    i = annual_rate / Decimal("12") / Decimal("100")
    b = balance
    count = 0
    max_iter = 1200

    while b > Decimal("0") and count < max_iter:
        interest = round2(b * i)
        principal = round2(monthly_payment - interest)
        if principal <= Decimal("0"):
            count = max_iter
            break
        b = round2(b - principal)
        count += 1

    return max(1, count)


def recalculate_schedule(
    initial_amount: Decimal,
    annual_rate: Decimal,
    monthly_payment: Decimal,
    payment_day: int,
    actual_payments: list[ActualPayment],
    next_payment_date: date,
) -> list[ScheduledPayment]:
    """
    SRS 4.4.
    1. Compute current balance from actual payments.
    2. Count remaining payments iteratively.
    3. Return generate_schedule(balance, ..., next_payment_date, payment_day).
    monthly_payment is unchanged (only changes if loan is edited).
    """
    balance = current_balance(initial_amount, annual_rate, monthly_payment, actual_payments)

    if balance <= Decimal("0"):
        return []

    n = _count_remaining_payments(balance, annual_rate, monthly_payment)
    return generate_schedule(balance, annual_rate, monthly_payment, n, next_payment_date, payment_day)


# ---------------------------------------------------------------------------
# SRS 4.7 — Closing base date
# ---------------------------------------------------------------------------

def closing_base_date(today: date) -> date:
    """SRS 4.7: first day of the next month from today."""
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


# ---------------------------------------------------------------------------
# SRS 4.6 — Simulate months to close all loans
# ---------------------------------------------------------------------------

def simulate_months(
    loans: list[LoanSnapshot],
    extra_per_month: Decimal,
    priority_indices: list[int],
) -> int:
    """
    SRS 4.6. Returns months until all loans reach balance == 0.
    Freed monthly payment → available in the NEXT month (freedNextMonth).
    """
    balances = [round2(loan.remaining_balance) for loan in loans]
    month = 0
    max_months = 1200
    freed_next_month = Decimal("0")

    while any(b > Decimal("0") for b in balances) and month < max_months:
        month += 1
        extra = extra_per_month + freed_next_month
        freed_next_month = Decimal("0")

        # Apply mandatory payments to all loans
        for idx, loan in enumerate(loans):
            if balances[idx] <= Decimal("0"):
                continue
            if loan.annual_rate == Decimal("0"):
                i = Decimal("0")
            else:
                i = loan.annual_rate / Decimal("12") / Decimal("100")

            interest = round2(balances[idx] * i)
            payment = loan.monthly_payment
            principal = round2(payment - interest)
            prev_balance = balances[idx]
            balances[idx] = max(Decimal("0"), round2(balances[idx] - principal))

            if balances[idx] == Decimal("0"):
                actual_last = round2(prev_balance + interest)
                extra += max(Decimal("0"), payment - actual_last)
                freed_next_month += payment

        # Apply extra to first live priority loan
        for idx in priority_indices:
            if idx < len(balances) and balances[idx] > Decimal("0"):
                reduction = min(extra, balances[idx])
                balances[idx] = round2(balances[idx] - reduction)
                if balances[idx] == Decimal("0"):
                    freed_next_month += loans[idx].monthly_payment
                break

    return month


# ---------------------------------------------------------------------------
# SRS 4.7 — Per-loan closing months
# ---------------------------------------------------------------------------

def simulate_to_close_per_loan(
    loans: list[LoanSnapshot],
    extra_per_month: Decimal,
    priority_indices: list[int],
) -> dict[UUID, int]:
    """
    SRS 4.7. Same simulation as simulate_months but records
    the month each individual loan reaches balance == 0.
    Returns {loan.id: months_to_close}.
    """
    balances = [round2(loan.remaining_balance) for loan in loans]
    closed_at: dict[UUID, int] = {}
    month = 0
    max_months = 1200
    freed_next_month = Decimal("0")

    while any(b > Decimal("0") for b in balances) and month < max_months:
        month += 1
        extra = extra_per_month + freed_next_month
        freed_next_month = Decimal("0")

        for idx, loan in enumerate(loans):
            if balances[idx] <= Decimal("0"):
                continue
            if loan.annual_rate == Decimal("0"):
                i = Decimal("0")
            else:
                i = loan.annual_rate / Decimal("12") / Decimal("100")

            interest = round2(balances[idx] * i)
            payment = loan.monthly_payment
            principal = round2(payment - interest)
            prev_balance = balances[idx]
            balances[idx] = max(Decimal("0"), round2(balances[idx] - principal))

            if balances[idx] == Decimal("0") and loan.id not in closed_at:
                closed_at[loan.id] = month
                actual_last = round2(prev_balance + interest)
                extra += max(Decimal("0"), payment - actual_last)
                freed_next_month += payment

        for idx in priority_indices:
            if idx < len(balances) and balances[idx] > Decimal("0"):
                reduction = min(extra, balances[idx])
                balances[idx] = round2(balances[idx] - reduction)
                if balances[idx] == Decimal("0") and loans[idx].id not in closed_at:
                    closed_at[loans[idx].id] = month
                    freed_next_month += loans[idx].monthly_payment
                break

    # Safety: any loan not yet recorded
    for loan in loans:
        if loan.id not in closed_at:
            closed_at[loan.id] = month

    return closed_at
