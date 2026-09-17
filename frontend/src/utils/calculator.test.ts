import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { annuityPayment, isZeroRatePlan, isPaymentSufficient } from './calculator'

describe('annuityPayment', () => {
  it('TC-CALC-01: S=100000, rate=24%, n=12 → A=9455.96', () => {
    const a = annuityPayment(new Decimal('100000'), new Decimal('24'), 12)
    expect(a.equals('9455.96')).toBe(true)
  })

  it('TC-CALC-02: rate=0%, S=12000, n=6 → A=2000.00', () => {
    const a = annuityPayment(new Decimal('12000'), new Decimal('0'), 6)
    expect(a.equals('2000.00')).toBe(true)
  })

  it('TC-CALC-03: rate=0%, S=150000, n=36 → A=4166.67', () => {
    const a = annuityPayment(new Decimal('150000'), new Decimal('0'), 36)
    expect(a.equals('4166.67')).toBe(true)
  })

  it('S=100000, rate=24%, n=24 → A=5287.11', () => {
    const a = annuityPayment(new Decimal('100000'), new Decimal('24'), 24)
    expect(a.equals('5287.11')).toBe(true)
  })
})

describe('isZeroRatePlan', () => {
  it('detects zero rate when A*n == S exactly', () => {
    expect(isZeroRatePlan(new Decimal('12000'), 6, new Decimal('2000'))).toBe(true)
  })

  it('detects zero rate within tolerance', () => {
    // 150000/36 = 4166.67, diff = 4166.67*36 - 150000 = 0.12, tolerance = 36*0.01 = 0.36
    expect(isZeroRatePlan(new Decimal('150000'), 36, new Decimal('4166.67'))).toBe(true)
  })

  it('returns false for rate > 0', () => {
    expect(isZeroRatePlan(new Decimal('100000'), 12, new Decimal('9455.96'))).toBe(false)
  })
})

describe('isPaymentSufficient', () => {
  it('returns true when A*n >= S', () => {
    expect(isPaymentSufficient(new Decimal('100000'), 12, new Decimal('9455.96'))).toBe(true)
  })

  it('returns false when A*n < S', () => {
    // TC-CALC-05: 5000*10 < 100000
    expect(isPaymentSufficient(new Decimal('100000'), 10, new Decimal('5000'))).toBe(false)
  })
})
