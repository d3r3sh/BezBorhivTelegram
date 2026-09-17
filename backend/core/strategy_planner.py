"""
Strategy planner — SRS 4.6, FR-STRAT.
Builds repayment plan (Avalanche / Snowball) using LoanCalculator simulation.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from .loan_calculator import LoanSnapshot, simulate_months, simulate_to_close_per_loan


# ---------------------------------------------------------------------------
# Strategy enum
# ---------------------------------------------------------------------------

class RepaymentStrategy(str, Enum):
    NONE = "none"
    AVALANCHE = "avalanche"   # highest rate first
    SNOWBALL = "snowball"     # smallest balance first


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class MonthlyRecommendation:
    loan_id: UUID
    loan_name: str
    mandatory_amount: Decimal    # obligatory monthly payment
    extra_amount: Decimal        # recommended extra payment for this loan

    @property
    def total_amount(self) -> Decimal:
        return self.mandatory_amount + self.extra_amount


@dataclass
class Plan:
    recommendations: list[MonthlyRecommendation]
    saved_months: int               # months saved vs baseline
    budget_shortfall: Optional[Decimal]  # > 0 if budget < mandatory total


# ---------------------------------------------------------------------------
# Priority helpers
# ---------------------------------------------------------------------------

def priority_indices(loans: list[LoanSnapshot], strategy: RepaymentStrategy) -> list[int]:
    """
    Return loan indices sorted by strategy priority.
    Avalanche: descending by annual_rate.
    Snowball:  ascending by remaining_balance.
    None:      original order.
    """
    if strategy == RepaymentStrategy.AVALANCHE:
        return sorted(range(len(loans)), key=lambda i: loans[i].annual_rate, reverse=True)
    if strategy == RepaymentStrategy.SNOWBALL:
        return sorted(range(len(loans)), key=lambda i: loans[i].remaining_balance)
    return list(range(len(loans)))


# ---------------------------------------------------------------------------
# Plan builder
# ---------------------------------------------------------------------------

def build_plan(
    loans: list[LoanSnapshot],
    monthly_budget: Optional[Decimal],
    strategy: RepaymentStrategy,
) -> Plan:
    """
    SRS 4.6, FR-STRAT-4..7.
    Returns Plan with per-loan monthly recommendations and saved_months effect.
    """
    if not loans:
        return Plan(recommendations=[], saved_months=0, budget_shortfall=None)

    mandatory_total = sum(loan.monthly_payment for loan in loans)
    indices = priority_indices(loans, strategy)

    # SRS FR-STRAT-5: budget < mandatory → soft warning, no extra recommendations
    if monthly_budget is not None and monthly_budget < mandatory_total:
        shortfall = mandatory_total - monthly_budget
        recs = [
            MonthlyRecommendation(
                loan_id=loan.id,
                loan_name=getattr(loan, "name", ""),
                mandatory_amount=loan.monthly_payment,
                extra_amount=Decimal("0"),
            )
            for loan in loans
        ]
        return Plan(recommendations=recs, saved_months=0, budget_shortfall=shortfall)

    extra_budget = (
        max(Decimal("0"), monthly_budget - mandatory_total)
        if monthly_budget is not None
        else Decimal("0")
    )

    # Baseline: no extra payments
    base_months = simulate_months(loans, Decimal("0"), indices)
    # Strategy: with extra
    strat_months = simulate_months(loans, extra_budget, indices)
    saved = max(0, base_months - strat_months)

    # Build recommendations — extra goes to first live priority loan
    recs: list[MonthlyRecommendation] = [
        MonthlyRecommendation(
            loan_id=loan.id,
            loan_name=getattr(loan, "name", ""),
            mandatory_amount=loan.monthly_payment,
            extra_amount=Decimal("0"),
        )
        for loan in loans
    ]

    if extra_budget > Decimal("0"):
        for idx in indices:
            if loans[idx].remaining_balance > Decimal("0"):
                recs[idx] = MonthlyRecommendation(
                    loan_id=loans[idx].id,
                    loan_name=getattr(loans[idx], "name", ""),
                    mandatory_amount=loans[idx].monthly_payment,
                    extra_amount=extra_budget,
                )
                break

    # Return recommendations sorted by priority (SRS FR-STRAT-7)
    sorted_recs = [recs[i] for i in indices]
    return Plan(recommendations=sorted_recs, saved_months=saved, budget_shortfall=None)
