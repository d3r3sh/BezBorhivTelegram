"""
GET /api/plan — repayment plan with strategy recommendations and closing dates.
Accepts ?strategy= and ?monthly_budget= query params for live preview
(overrides user settings without saving them).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.core.loan_calculator import (
    LoanSnapshot,
    add_months,
    closing_base_date,
    simulate_to_close_per_loan,
)
from backend.core.strategy_planner import (
    RepaymentStrategy,
    build_plan,
    priority_indices,
)
from backend.db.models import User
from backend.services.loan_service import get_loans

router = APIRouter(prefix="/plan", tags=["plan"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MonthlyRec(BaseModel):
    loan_id: UUID
    loan_name: str
    mandatory_amount: Decimal
    extra_amount: Decimal
    total_amount: Decimal


class PlanOut(BaseModel):
    strategy: str
    recommendations: List[MonthlyRec]
    saved_months: int
    budget_shortfall: Optional[Decimal]
    closing_date_all: Optional[str]          # ISO date (YYYY-MM-DD)
    closing_dates: Dict[str, Optional[str]]  # loan_id → ISO date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_strategy(s: Optional[str]) -> RepaymentStrategy:
    if not s or s == "none":
        return RepaymentStrategy.AVALANCHE
    try:
        return RepaymentStrategy(s)
    except ValueError:
        return RepaymentStrategy.AVALANCHE


def _iso_date(base: date, months: int) -> str:
    year, month = add_months(base, months)
    return date(year, month, 1).isoformat()


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=PlanOut)
def get_plan(
    strategy: Optional[str] = Query(None, description="Override strategy for preview"),
    monthly_budget: Optional[Decimal] = Query(None, description="Override budget for preview"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns the repayment plan for the current user.
    Query params `strategy` and `monthly_budget` allow live preview
    without persisting changes to user settings.
    """
    eff_strategy_str = strategy or user.strategy or "avalanche"
    eff_strategy = _resolve_strategy(eff_strategy_str)

    eff_budget: Optional[Decimal] = monthly_budget
    if eff_budget is None and user.monthly_budget is not None:
        eff_budget = Decimal(str(user.monthly_budget))

    loans_out = get_loans(db, user, archived=False)
    active = [l for l in loans_out if l.current_balance > Decimal("0")]

    if not active:
        return PlanOut(
            strategy=eff_strategy_str,
            recommendations=[],
            saved_months=0,
            budget_shortfall=None,
            closing_date_all=None,
            closing_dates={},
        )

    snapshots = [
        LoanSnapshot(
            id=l.id,
            remaining_balance=l.current_balance,
            annual_rate=l.annual_rate,
            monthly_payment=l.monthly_payment,
            name=l.name,
        )
        for l in active
    ]

    plan = build_plan(snapshots, eff_budget, eff_strategy)

    recs = [
        MonthlyRec(
            loan_id=r.loan_id,
            loan_name=r.loan_name,
            mandatory_amount=r.mandatory_amount,
            extra_amount=r.extra_amount,
            total_amount=r.total_amount,
        )
        for r in plan.recommendations
    ]

    # Closing dates via simulation
    mandatory_total = sum(s.monthly_payment for s in snapshots)
    extra_budget = (
        max(Decimal("0"), eff_budget - mandatory_total)
        if eff_budget is not None else Decimal("0")
    )
    indices = priority_indices(snapshots, eff_strategy)
    months_map = simulate_to_close_per_loan(snapshots, extra_budget, indices)

    base = closing_base_date(date.today())
    closing_dates_iso: Dict[str, Optional[str]] = {
        str(lid): _iso_date(base, m) for lid, m in months_map.items()
    }
    max_months = max(months_map.values()) if months_map else 0
    closing_date_all = _iso_date(base, max_months) if max_months else None

    return PlanOut(
        strategy=eff_strategy_str,
        recommendations=recs,
        saved_months=plan.saved_months,
        budget_shortfall=plan.budget_shortfall,
        closing_date_all=closing_date_all,
        closing_dates=closing_dates_iso,
    )
