import type { CalendarEvent } from '../api/types'

export const LOAN_COLORS: Record<number, string> = {
  1: '#4A90E2',
  2: '#E2844A',
  3: '#27AE60',
  4: '#9B59B6',
  5: '#E74C3C',
  6: '#1ABC9C',
  7: '#E8A838',
  8: '#E91E63',
  9: '#795548',
  10: '#607D8B',
}

export const PAID_COLOR = '#22C55E'
export const OVERDUE_COLOR = '#F97316'
export const FALLBACK_COLOR = '#8E8E8E'

export const MONTH_NAMES_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export function getLoanColor(colorIndex: number): string {
  return LOAN_COLORS[colorIndex] ?? FALLBACK_COLOR
}

/**
 * Returns an array of day numbers (1-based) or null for empty leading cells.
 * Week starts on Monday (Ukrainian convention).
 */
export function getMonthGrid(year: number, month: number): Array<number | null> {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingNulls = (firstDayOfWeek + 6) % 7 // Mon=0 … Sun=6

  const cells: Array<number | null> = []
  for (let i = 0; i < leadingNulls; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

/** Add n months to a (year, month) pair. Month is 1-indexed. */
export function addMonthsToYearMonth(
  year: number,
  month: number,
  n: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + n
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

/** Group events by ISO date key "YYYY-MM-DD". */
export function groupEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  const result: Record<string, CalendarEvent[]> = {}
  for (const ev of events) {
    if (!result[ev.date]) result[ev.date] = []
    result[ev.date].push(ev)
  }
  return result
}

/** Format a date string to ISO "YYYY-MM-DD" for a given year/month/day. */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
