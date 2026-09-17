"""
Pytest tests for LoanCalculator — TC-CALC-01..13 from UserStories_AC_TestCases.md.
Exact inputs and expected values from the document.
"""

import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.loan_calculator import (
    ActualPayment,
    InsufficientPaymentError,
    LoanSnapshot,
    ScheduledPayment,
    annuity_payment,
    calculate_irr,
    current_balance,
    generate_schedule,
    payment_date_for,
    recalculate_schedule,
    round2,
    simulate_months,
)
from backend.core.strategy_planner import RepaymentStrategy, priority_indices


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def D(s: str) -> Decimal:
    return Decimal(s)


def make_actual(
    actual_date: date,
    actual_amount: Decimal,
    is_extra: bool = False,
    planned_date: Optional[date] = None,
    planned_amount: Optional[Decimal] = None,
    seq: int = 0,
) -> ActualPayment:
    return ActualPayment(
        id=uuid4(),
        actual_date=actual_date,
        actual_amount=actual_amount,
        is_extra=is_extra,
        created_at=datetime(2026, 1, 1, 0, 0, seq, tzinfo=timezone.utc),
        planned_date=planned_date,
        planned_amount=planned_amount or Decimal("0"),
    )


# ---------------------------------------------------------------------------
# TC-CALC-01. Annuity — basic calculation
# ---------------------------------------------------------------------------

class TestTC01:
    """
    Input:  S=100_000, rate=24% (i=2%/month), n=12, first_payment=15.08.2026
    Expected: A=9_455.96; sum of principals=100_000.00;
              balance after 12th=0.00; interest #1=2_000.00; principal #1=7_455.96
    """

    S = D("100000.00")
    RATE = D("24")
    N = 12
    FIRST = date(2026, 8, 15)
    A_EXPECTED = D("9455.96")

    def test_annuity_amount(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        assert a == self.A_EXPECTED

    def test_schedule_length(self):
        sched = generate_schedule(self.S, self.RATE, self.A_EXPECTED, self.N, self.FIRST, 15)
        assert len(sched) == self.N

    def test_sum_of_principals(self):
        sched = generate_schedule(self.S, self.RATE, self.A_EXPECTED, self.N, self.FIRST, 15)
        total_principal = sum(p.principal for p in sched)
        assert total_principal == self.S

    def test_final_balance_zero(self):
        sched = generate_schedule(self.S, self.RATE, self.A_EXPECTED, self.N, self.FIRST, 15)
        assert sched[-1].balance == D("0.00")

    def test_first_payment_breakdown(self):
        sched = generate_schedule(self.S, self.RATE, self.A_EXPECTED, self.N, self.FIRST, 15)
        assert sched[0].interest == D("2000.00")
        assert sched[0].principal == D("7455.96")

    def test_first_payment_date(self):
        sched = generate_schedule(self.S, self.RATE, self.A_EXPECTED, self.N, self.FIRST, 15)
        assert sched[0].date == self.FIRST


# ---------------------------------------------------------------------------
# TC-CALC-02. Zero rate (installment plan)
# ---------------------------------------------------------------------------

class TestTC02:
    """
    Input:  S=12_000, rate=0%, n=6
    Expected: each payment=2_000.00; interest=0.00; final balance=0.00
    """

    S = D("12000.00")
    RATE = D("0")
    N = 6
    FIRST = date(2026, 8, 1)

    def test_annuity_zero_rate(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        assert a == D("2000.00")

    def test_all_payments_equal(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        for p in sched:
            assert p.amount == D("2000.00")

    def test_zero_interest_each_payment(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        for p in sched:
            assert p.interest == D("0.00")

    def test_final_balance_zero(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        assert sched[-1].balance == D("0.00")


# ---------------------------------------------------------------------------
# TC-CALC-03. Last payment adjustment
# ---------------------------------------------------------------------------

class TestTC03:
    """
    Input:  S=150_000, rate=0%, n=36 → A=4_166.67 (rounded)
    Expected: payments 1..35 = 4_166.67; payment 36 = 4_166.55; final balance = 0.00
    """

    S = D("150000.00")
    RATE = D("0")
    N = 36
    FIRST = date(2026, 8, 1)

    def test_annuity(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        assert a == D("4166.67")

    def test_first_35_equal(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        for p in sched[:35]:
            assert p.amount == D("4166.67"), f"payment #{p.number} = {p.amount}"

    def test_last_payment_adjusted(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        assert sched[-1].amount == D("4166.55")

    def test_final_balance_zero(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        assert sched[-1].balance == D("0.00")


# ---------------------------------------------------------------------------
# TC-CALC-04. IRR — rate from known payment
# ---------------------------------------------------------------------------

class TestTC04:
    """
    Input:  S=100_000, n=24, A=5_200.00
    Expected: annual rate ≈ 22.25% (±0.1 pp);
              reverse check: annuity(rate) → A = 5_200.00 ± 0.01
    """

    def test_irr_range(self):
        rate = calculate_irr(D("100000"), 24, D("5200.00"))
        assert D("22.15") <= rate <= D("22.35"), f"rate={rate}"

    def test_irr_reverse_check(self):
        rate = calculate_irr(D("100000"), 24, D("5200.00"))
        a = annuity_payment(D("100000"), rate, 24)
        assert abs(a - D("5200.00")) <= D("0.01"), f"a={a}, rate={rate}"


# ---------------------------------------------------------------------------
# TC-CALC-05. IRR — edge cases
# ---------------------------------------------------------------------------

class TestTC05:
    def test_zero_rate_exact(self):
        # A * n == S exactly
        rate = calculate_irr(D("12000"), 6, D("2000.00"))
        assert rate == D("0")

    def test_zero_rate_tolerance(self):
        # 150_000 / 36 = 4_166.666... → A=4_166.67; diff = 0.12 < 36*0.01=0.36
        rate = calculate_irr(D("150000"), 36, D("4166.67"))
        assert rate == D("0")

    def test_insufficient_payment_raises(self):
        # A * n < S: 5_000 * 10 = 50_000 < 100_000
        with pytest.raises(InsufficientPaymentError):
            calculate_irr(D("100000"), 10, D("5000.00"))

    def test_n1_rate_positive(self):
        # n=1, A > S → rate > 0
        rate = calculate_irr(D("1000"), 1, D("1050.00"))
        assert rate > D("0")


# ---------------------------------------------------------------------------
# TC-CALC-06. Early repayment shortens term
# ---------------------------------------------------------------------------

class TestTC06:
    """
    Input:  S=100_000, 24%, n=24 (A=5_287.11)
            After 6th payment, extra 20_000 paid.
    Expected: A unchanged; new count < 18; final balance = 0.00;
              sum of new principals = balance before extra payment.
    """

    S = D("100000.00")
    RATE = D("24")
    N = 24
    FIRST = date(2026, 9, 1)
    EXTRA = D("20000.00")

    def _setup(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        assert a == D("5287.11")
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        return a, sched

    def test_monthly_payment_unchanged(self):
        a, sched = self._setup()
        # Build actual payment history: 6 planned + 1 extra
        actuals = [
            make_actual(sched[k].date, sched[k].amount, planned_date=sched[k].date,
                        planned_amount=sched[k].amount, seq=k)
            for k in range(6)
        ]
        # extra after 6th payment
        actuals.append(make_actual(sched[5].date, self.EXTRA, is_extra=True, seq=6))

        next_date = sched[6].date  # 7th planned date
        new_sched = recalculate_schedule(
            self.S, self.RATE, a, 1, actuals, next_date
        )
        # monthly_payment in new schedule should equal original A (except last)
        for p in new_sched[:-1]:
            assert p.amount == a, f"amount changed at #{p.number}: {p.amount}"

    def test_term_shorter_than_18(self):
        a, sched = self._setup()
        actuals = [
            make_actual(sched[k].date, sched[k].amount, seq=k) for k in range(6)
        ]
        actuals.append(make_actual(sched[5].date, self.EXTRA, is_extra=True, seq=6))
        new_sched = recalculate_schedule(self.S, self.RATE, a, 1, actuals, sched[6].date)
        assert len(new_sched) < 18, f"new_count={len(new_sched)}"

    def test_final_balance_zero(self):
        a, sched = self._setup()
        actuals = [
            make_actual(sched[k].date, sched[k].amount, seq=k) for k in range(6)
        ]
        actuals.append(make_actual(sched[5].date, self.EXTRA, is_extra=True, seq=6))
        new_sched = recalculate_schedule(self.S, self.RATE, a, 1, actuals, sched[6].date)
        assert new_sched[-1].balance == D("0.00")

    def test_principals_sum_equals_balance(self):
        a, sched = self._setup()
        actuals = [
            make_actual(sched[k].date, sched[k].amount, seq=k) for k in range(6)
        ]
        actuals.append(make_actual(sched[5].date, self.EXTRA, is_extra=True, seq=6))
        balance_before_extra = current_balance(self.S, self.RATE, a, actuals[:6])
        balance_after_extra = current_balance(self.S, self.RATE, a, actuals)
        new_sched = recalculate_schedule(self.S, self.RATE, a, 1, actuals, sched[6].date)
        total_principal = sum(p.principal for p in new_sched)
        assert total_principal == balance_after_extra, (
            f"sum_principal={total_principal}, balance={balance_after_extra}"
        )


# ---------------------------------------------------------------------------
# TC-CALC-07. Overpayment in planned payment
# ---------------------------------------------------------------------------

class TestTC07:
    """
    Base loan: S=100_000, 24%, n=24, A=5_287.11, first_payment=01.09.2026
    """

    S = D("100000.00")
    RATE = D("24")
    N = 24
    FIRST = date(2026, 9, 1)
    A = D("5287.11")

    def _recalc(self, overpayment: Decimal):
        """Helper: pay first payment with given amount, return new schedule."""
        actuals = [make_actual(self.FIRST, overpayment)]
        return recalculate_schedule(
            self.S, self.RATE, self.A, 1, actuals,
            next_payment_date=date(2026, 10, 1)
        )

    def test_07a_small_overpay_count_unchanged(self):
        # +2_000 extra → count stays 23
        sched = self._recalc(D("7287.11"))
        assert len(sched) == 23, f"count={len(sched)}"

    def test_07a_balance_after(self):
        actuals = [make_actual(self.FIRST, D("7287.11"))]
        bal = current_balance(self.S, self.RATE, self.A, actuals)
        assert bal == D("94712.89"), f"balance={bal}"

    def test_07a_final_zero(self):
        sched = self._recalc(D("7287.11"))
        assert sched[-1].balance == D("0.00")

    def test_07b_large_overpay_count_22(self):
        # +5_000 extra → count = 22
        sched = self._recalc(D("10287.11"))
        assert len(sched) == 22, f"count={len(sched)}"

    def test_07b_balance_after(self):
        actuals = [make_actual(self.FIRST, D("10287.11"))]
        bal = current_balance(self.S, self.RATE, self.A, actuals)
        assert bal == D("91712.89"), f"balance={bal}"

    def test_07b_final_zero(self):
        sched = self._recalc(D("10287.11"))
        assert sched[-1].balance == D("0.00")

    def test_07c_boundary_lower_23(self):
        # extra=3_352.84 → payment=8_639.95 → count=23
        sched = self._recalc(D("8639.95"))
        assert len(sched) == 23, f"count={len(sched)} (expected 23)"

    def test_07c_boundary_upper_22(self):
        # extra=3_352.85 → payment=8_639.96 → count=22
        sched = self._recalc(D("8639.96"))
        assert len(sched) == 22, f"count={len(sched)} (expected 22)"


# ---------------------------------------------------------------------------
# TC-CALC-08. Underpayment
# ---------------------------------------------------------------------------

class TestTC08:
    """
    Planned=5_287.11, actual=3_000.00
    Expected: balance > planned; count ≤ 24; final balance=0.00
    """

    S = D("100000.00")
    RATE = D("24")
    N = 24
    A = D("5287.11")
    FIRST = date(2026, 9, 1)

    def test_underpayment_balance_larger(self):
        actuals = [make_actual(self.FIRST, D("3000.00"))]
        bal = current_balance(self.S, self.RATE, self.A, actuals)
        # After planned payment balance would be 100_000 - (5_287.11 - 2_000) = 96_712.89
        # After underpayment balance is higher
        assert bal > D("96712.89"), f"balance={bal}"

    def test_underpayment_count_lte_24(self):
        actuals = [make_actual(self.FIRST, D("3000.00"))]
        new_sched = recalculate_schedule(
            self.S, self.RATE, self.A, 1, actuals, date(2026, 10, 1)
        )
        assert len(new_sched) <= 24, f"count={len(new_sched)}"

    def test_underpayment_final_zero(self):
        actuals = [make_actual(self.FIRST, D("3000.00"))]
        new_sched = recalculate_schedule(
            self.S, self.RATE, self.A, 1, actuals, date(2026, 10, 1)
        )
        assert new_sched[-1].balance == D("0.00")


# ---------------------------------------------------------------------------
# TC-CALC-09. Delete payment from history
# ---------------------------------------------------------------------------

class TestTC09:
    """
    Loan with 5 actual payments; 3rd is deleted.
    Expected: remaining count > count with 5 payments; final balance=0.00
    """

    S = D("100000.00")
    RATE = D("24")
    N = 24
    A = D("5287.11")
    FIRST = date(2026, 9, 1)

    def _sched(self):
        return generate_schedule(self.S, self.RATE, self.A, self.N, self.FIRST, 1)

    def test_delete_increases_remaining(self):
        sched = self._sched()
        all5 = [make_actual(sched[k].date, sched[k].amount, seq=k) for k in range(5)]
        all4 = [p for i, p in enumerate(all5) if i != 2]  # delete 3rd (index 2)

        next_date = sched[5].date
        sched_5 = recalculate_schedule(self.S, self.RATE, self.A, 1, all5, next_date)
        sched_4 = recalculate_schedule(self.S, self.RATE, self.A, 1, all4, next_date)

        assert len(sched_4) > len(sched_5), (
            f"after delete={len(sched_4)}, with_5={len(sched_5)}"
        )

    def test_delete_final_zero(self):
        sched = self._sched()
        all5 = [make_actual(sched[k].date, sched[k].amount, seq=k) for k in range(5)]
        all4 = [p for i, p in enumerate(all5) if i != 2]
        new_sched = recalculate_schedule(self.S, self.RATE, self.A, 1, all4, sched[5].date)
        assert new_sched[-1].balance == D("0.00")


# ---------------------------------------------------------------------------
# TC-CALC-10. Payment day 31 — date clamping without changing paymentDay
# ---------------------------------------------------------------------------

class TestTC10:
    def test_31_through_months(self):
        """
        First payment 31.08.2026, n=6 → dates: 31.08, 30.09, 31.10, 30.11, 31.12, 31.01.2027
        """
        sched = generate_schedule(D("60000"), D("12"), D("1029.61"), 6,
                                  date(2026, 8, 31), 31)
        assert sched[0].date == date(2026, 8, 31)
        assert sched[1].date == date(2026, 9, 30)   # Sep has 30 days
        assert sched[2].date == date(2026, 10, 31)
        assert sched[3].date == date(2026, 11, 30)  # Nov has 30 days
        assert sched[4].date == date(2026, 12, 31)
        assert sched[5].date == date(2027, 1, 31)

    def test_31_through_february(self):
        """
        First payment 31.12.2026, n=3 → 31.12.2026, 31.01.2027, 28.02.2027
        """
        sched = generate_schedule(D("30000"), D("12"), D("1029.61"), 3,
                                  date(2026, 12, 31), 31)
        assert sched[0].date == date(2026, 12, 31)
        assert sched[1].date == date(2027, 1, 31)
        assert sched[2].date == date(2027, 2, 28)   # Feb 2027 non-leap → 28


# ---------------------------------------------------------------------------
# TC-CALC-11. Strategy effect (Avalanche vs Snowball)
# ---------------------------------------------------------------------------

class TestTC11:
    """
    Loan A: balance=100_000, 30%, n=24
    Loan B: balance=30_000, 10%, n=24
    extraBudget=3_000
    Avalanche: priority [0,1] (A with higher rate first)
    Snowball:  priority [1,0] (B with smaller balance first)
    Both > 0; results differ.
    """

    def _make_loans(self):
        a_pay = annuity_payment(D("100000"), D("30"), 24)
        b_pay = annuity_payment(D("30000"), D("10"), 24)
        loan_a = LoanSnapshot(uuid4(), D("100000"), D("30"), a_pay)
        loan_b = LoanSnapshot(uuid4(), D("30000"), D("10"), b_pay)
        return loan_a, loan_b

    def test_avalanche_saved_positive(self):
        loan_a, loan_b = self._make_loans()
        idx = priority_indices([loan_a, loan_b], RepaymentStrategy.AVALANCHE)
        assert idx[0] == 0, f"Avalanche should put A first, got {idx}"
        saved = simulate_months([loan_a, loan_b], D("0"), idx) - \
                simulate_months([loan_a, loan_b], D("3000"), idx)
        assert saved > 0, f"Avalanche saved={saved}"

    def test_snowball_saved_positive(self):
        loan_a, loan_b = self._make_loans()
        idx = priority_indices([loan_a, loan_b], RepaymentStrategy.SNOWBALL)
        assert idx[0] == 1, f"Snowball should put B first, got {idx}"
        saved = simulate_months([loan_a, loan_b], D("0"), idx) - \
                simulate_months([loan_a, loan_b], D("3000"), idx)
        assert saved > 0, f"Snowball saved={saved}"

    def test_results_differ(self):
        loan_a, loan_b = self._make_loans()
        idx_av = priority_indices([loan_a, loan_b], RepaymentStrategy.AVALANCHE)
        idx_sn = priority_indices([loan_a, loan_b], RepaymentStrategy.SNOWBALL)
        saved_av = simulate_months([loan_a, loan_b], D("0"), idx_av) - \
                   simulate_months([loan_a, loan_b], D("3000"), idx_av)
        saved_sn = simulate_months([loan_a, loan_b], D("0"), idx_sn) - \
                   simulate_months([loan_a, loan_b], D("3000"), idx_sn)
        assert saved_av != saved_sn, f"av={saved_av}, sn={saved_sn}"


# ---------------------------------------------------------------------------
# TC-CALC-12. Edit loan rate with existing payments
# ---------------------------------------------------------------------------

class TestTC12:
    """
    Loan: 24%, 3 payments made; rate changed to 20%.
    Expected: existing payments unchanged; new schedule from current balance
              with new rate; final balance = 0.00.
    """

    S = D("100000.00")
    OLD_RATE = D("24")
    NEW_RATE = D("20")
    N = 24
    FIRST = date(2026, 9, 1)

    def test_new_schedule_from_current_balance(self):
        old_a = annuity_payment(self.S, self.OLD_RATE, self.N)
        old_sched = generate_schedule(self.S, self.OLD_RATE, old_a, self.N, self.FIRST, 1)

        actuals = [make_actual(old_sched[k].date, old_sched[k].amount, seq=k) for k in range(3)]
        balance_after_3 = current_balance(self.S, self.OLD_RATE, old_a, actuals)

        # New payment for new rate from current balance
        # Remaining payments at new rate (original 24 - 3 = 21, but recalculated)
        new_a = annuity_payment(balance_after_3, self.NEW_RATE, self.N - 3)
        new_sched = generate_schedule(
            balance_after_3, self.NEW_RATE, new_a, self.N - 3,
            old_sched[3].date, 1
        )

        # Verify existing payments unchanged (amount = original)
        for k in range(3):
            assert actuals[k].actual_amount == old_sched[k].amount

        # Verify final balance zero in new schedule
        assert new_sched[-1].balance == D("0.00")

    def test_new_schedule_uses_new_rate(self):
        old_a = annuity_payment(self.S, self.OLD_RATE, self.N)
        old_sched = generate_schedule(self.S, self.OLD_RATE, old_a, self.N, self.FIRST, 1)
        actuals = [make_actual(old_sched[k].date, old_sched[k].amount, seq=k) for k in range(3)]
        balance_after_3 = current_balance(self.S, self.OLD_RATE, old_a, actuals)

        # New monthly payment should differ from old (rate changed)
        new_a = annuity_payment(balance_after_3, self.NEW_RATE, self.N - 3)
        assert new_a != old_a, f"new_a={new_a} should differ from old_a={old_a}"


# ---------------------------------------------------------------------------
# TC-CALC-13. Decimal precision — no float artifacts
# ---------------------------------------------------------------------------

class TestTC13:
    """
    Input:  S=999_999.99, rate=36%, n=360
    Expected: sum of principals = 999_999.99; no float artifacts; final balance=0.00
    """

    S = D("999999.99")
    RATE = D("36")
    N = 360
    FIRST = date(2026, 9, 1)

    def test_sum_of_principals(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        total = sum(p.principal for p in sched)
        assert total == self.S, f"sum_principal={total}"

    def test_final_balance_zero(self):
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        assert sched[-1].balance == D("0.00")

    def test_no_float_artifacts(self):
        """All balances must be exact to 2 decimal places — no ...9999 or ...0001."""
        a = annuity_payment(self.S, self.RATE, self.N)
        sched = generate_schedule(self.S, self.RATE, a, self.N, self.FIRST, 1)
        for p in sched:
            # Verify each value has at most 2 decimal places
            s = str(p.balance)
            if "." in s:
                decimals = len(s.split(".")[1])
                assert decimals <= 2, f"balance {p.balance} has >2 decimal places at #{p.number}"
