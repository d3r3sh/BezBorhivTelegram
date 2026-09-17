/**
 * Client-side financial calculations using Decimal.js.
 * Mirrors loan_calculator.py logic for live form previews.
 * All actual server-side calculations remain in Python.
 */
import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

function round2(v: Decimal): Decimal {
  return v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/**
 * Calculate annuity monthly payment (SRS 4.1).
 * rate=0 → A = principal / n
 */
export function annuityPayment(
  principal: Decimal,
  annualRate: Decimal,
  n: number,
): Decimal {
  if (annualRate.isZero()) {
    return round2(principal.div(n))
  }
  const i = annualRate.div(12).div(100)
  const factor = i.plus(1).pow(n)
  return round2(principal.mul(i).mul(factor).div(factor.minus(1)))
}

/**
 * Check if monthly_payment × n ≈ principal (within n × 0.01 tolerance).
 * Returns true if zero-rate installment plan.
 */
export function isZeroRatePlan(
  principal: Decimal,
  n: number,
  monthlyPayment: Decimal,
): boolean {
  const total = monthlyPayment.mul(n)
  const diff = total.minus(principal).abs()
  return diff.lte(new Decimal(n).mul('0.01'))
}

/**
 * Quick validity check: monthly_payment × n >= principal.
 * Returns false if payment is insufficient (SRS 4.3 error condition).
 */
export function isPaymentSufficient(
  principal: Decimal,
  n: number,
  monthlyPayment: Decimal,
): boolean {
  return monthlyPayment.mul(n).gte(principal)
}
