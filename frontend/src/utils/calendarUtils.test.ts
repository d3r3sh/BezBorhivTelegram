import { describe, it, expect } from 'vitest'
import {
  getMonthGrid,
  addMonthsToYearMonth,
  groupEventsByDate,
  toDateStr,
  getLoanColor,
  LOAN_COLORS,
  FALLBACK_COLOR,
} from './calendarUtils'
import type { CalendarEvent } from '../api/types'

// ---------------------------------------------------------------------------
// getMonthGrid
// ---------------------------------------------------------------------------

describe('getMonthGrid', () => {
  it('January 2030 starts on Tuesday (1 null + 31 days = 32 cells)', () => {
    // Jan 1 2030 is a Tuesday → Mon=0, Tue=1 → 1 leading null
    const grid = getMonthGrid(2030, 1)
    expect(grid[0]).toBeNull()
    expect(grid[1]).toBe(1)
    expect(grid[grid.length - 1]).toBe(31)
    expect(grid.filter(x => x !== null)).toHaveLength(31)
  })

  it('February 2028 (leap year) has 29 days', () => {
    const grid = getMonthGrid(2028, 2)
    const days = grid.filter(x => x !== null) as number[]
    expect(days).toHaveLength(29)
    expect(days[days.length - 1]).toBe(29)
  })

  it('February 2026 (non-leap) has 28 days', () => {
    const grid = getMonthGrid(2026, 2)
    const days = grid.filter(x => x !== null) as number[]
    expect(days).toHaveLength(28)
  })

  it('Grid starts with nulls equal to weekday offset (Mon=0 … Sun=6)', () => {
    // March 2026: March 1 is Sunday → offset = (0 + 6) % 7 = 6
    const grid = getMonthGrid(2026, 3)
    const nullCount = grid.indexOf(1) // first non-null position
    expect(nullCount).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// addMonthsToYearMonth
// ---------------------------------------------------------------------------

describe('addMonthsToYearMonth', () => {
  it('adds 0 months → same year/month', () => {
    expect(addMonthsToYearMonth(2026, 9, 0)).toEqual({ year: 2026, month: 9 })
  })

  it('adds 3 months across year boundary', () => {
    expect(addMonthsToYearMonth(2026, 11, 3)).toEqual({ year: 2027, month: 2 })
  })

  it('adds 24 months (2 years)', () => {
    expect(addMonthsToYearMonth(2026, 1, 24)).toEqual({ year: 2028, month: 1 })
  })

  it('handles month 12 + 1 correctly', () => {
    expect(addMonthsToYearMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })
})

// ---------------------------------------------------------------------------
// groupEventsByDate
// ---------------------------------------------------------------------------

describe('groupEventsByDate', () => {
  const makeEvent = (date: string, loanId: string): CalendarEvent => ({
    date,
    loan_id: loanId,
    loan_name: 'Test',
    color_index: 1,
    planned_amount: '1000.00',
    is_paid: false,
    is_overdue: false,
  })

  it('groups multiple events on same date', () => {
    const events = [
      makeEvent('2030-03-15', 'loan-1'),
      makeEvent('2030-03-15', 'loan-2'),
      makeEvent('2030-04-15', 'loan-1'),
    ]
    const grouped = groupEventsByDate(events)
    expect(grouped['2030-03-15']).toHaveLength(2)
    expect(grouped['2030-04-15']).toHaveLength(1)
  })

  it('returns empty record for empty input', () => {
    expect(groupEventsByDate([])).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// toDateStr
// ---------------------------------------------------------------------------

describe('toDateStr', () => {
  it('pads month and day with zeros', () => {
    expect(toDateStr(2026, 9, 5)).toBe('2026-09-05')
  })

  it('handles double-digit month/day', () => {
    expect(toDateStr(2030, 12, 31)).toBe('2030-12-31')
  })
})

// ---------------------------------------------------------------------------
// getLoanColor
// ---------------------------------------------------------------------------

describe('getLoanColor', () => {
  it('returns defined color for index 1-10', () => {
    for (let i = 1; i <= 10; i++) {
      expect(getLoanColor(i)).toBe(LOAN_COLORS[i])
    }
  })

  it('returns fallback for unknown index', () => {
    expect(getLoanColor(0)).toBe(FALLBACK_COLOR)
    expect(getLoanColor(11)).toBe(FALLBACK_COLOR)
  })
})
