import { describe, it, expect } from 'vitest'
import {
  formatAmount,
  formatDate,
  formatShortDate,
  monthsPhrase,
  paymentsPhrase,
} from './format'

const NBSP = ' ' // non-breaking space U+00A0

describe('formatAmount', () => {
  it('formats small amount', () => {
    expect(formatAmount('999.99')).toBe(`999,99 ₴`)
  })

  it('inserts non-breaking space as thousands separator', () => {
    expect(formatAmount('4500')).toBe(`4${NBSP}500,00 ₴`)
  })

  it('handles hundred thousands', () => {
    expect(formatAmount('100000')).toBe(`100${NBSP}000,00 ₴`)
  })

  it('handles millions', () => {
    expect(formatAmount('1000000')).toBe(`1${NBSP}000${NBSP}000,00 ₴`)
  })

  it('rounds half-up at 2 decimals', () => {
    expect(formatAmount('9455.955')).toBe(`9${NBSP}455,96 ₴`)
    expect(formatAmount('9455.954')).toBe(`9${NBSP}455,95 ₴`)
  })

  it('accepts number input', () => {
    expect(formatAmount(2000)).toBe(`2${NBSP}000,00 ₴`)
  })

  it('handles string with already 2 decimals', () => {
    expect(formatAmount('9455.96')).toBe(`9${NBSP}455,96 ₴`)
  })
})

describe('formatDate', () => {
  it('formats date in full Ukrainian genitive', () => {
    expect(formatDate('2026-08-15')).toBe('15 серпня 2026 року')
  })

  it('uses genitive month names', () => {
    const cases = [
      ['2026-01-01', 'січня'],
      ['2026-02-01', 'лютого'],
      ['2026-03-01', 'березня'],
      ['2026-04-01', 'квітня'],
      ['2026-05-01', 'травня'],
      ['2026-06-01', 'червня'],
      ['2026-07-01', 'липня'],
      ['2026-09-01', 'вересня'],
      ['2026-10-01', 'жовтня'],
      ['2026-11-01', 'листопада'],
      ['2026-12-01', 'грудня'],
    ] as const
    for (const [date, month] of cases) {
      expect(formatDate(date)).toContain(month)
    }
  })
})

describe('formatShortDate', () => {
  it('formats as short date', () => {
    expect(formatShortDate('2026-08-15')).toBe('15 сер')
    expect(formatShortDate('2026-02-28')).toBe('28 лют')
  })
})

describe('monthsPhrase', () => {
  it('1 місяць', () => expect(monthsPhrase(1)).toBe('1 місяць'))
  it('2 місяці', () => expect(monthsPhrase(2)).toBe('2 місяці'))
  it('5 місяців', () => expect(monthsPhrase(5)).toBe('5 місяців'))
  it('11 місяців (not 1)', () => expect(monthsPhrase(11)).toBe('11 місяців'))
  it('21 місяць', () => expect(monthsPhrase(21)).toBe('21 місяць'))
  it('24 місяці', () => expect(monthsPhrase(24)).toBe('24 місяці'))
  it('100 місяців', () => expect(monthsPhrase(100)).toBe('100 місяців'))
})

describe('paymentsPhrase', () => {
  it('1 платіж', () => expect(paymentsPhrase(1)).toBe('1 платіж'))
  it('3 платежі', () => expect(paymentsPhrase(3)).toBe('3 платежі'))
  it('12 платежів', () => expect(paymentsPhrase(12)).toBe('12 платежів'))
})
