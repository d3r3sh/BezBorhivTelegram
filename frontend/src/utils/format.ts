import Decimal from 'decimal.js'

/** Non-breaking space U+00A0 — thousands separator per SRS */
const NBSP = ' '

const MONTHS_GEN = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
]
const MONTHS_SHORT = [
  'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
  'лип', 'сер', 'вер', 'жов', 'лис', 'гру',
]

/**
 * Format monetary value as e.g. 4 500,00 ₴ (non-breaking space as thousands sep).
 * Accepts string or number from the API.
 */
export function formatAmount(value: string | number): string {
  const d = new Decimal(String(value)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const fixed = d.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${formatted},${decPart} ₴`
}

/**
 * Format ISO date string as e.g. 6 лютого 2028 року (SRS 4.7).
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} року`
}

/**
 * Format ISO date as short e.g. 6 лют.
 */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/**
 * Ukrainian plural for months.
 */
export function monthsPhrase(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return `${n} місяців`
  if (mod10 === 1) return `${n} місяць`
  if (mod10 >= 2 && mod10 <= 4) return `${n} місяці`
  return `${n} місяців`
}

/**
 * Ukrainian plural for payments.
 */
export function paymentsPhrase(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return `${n} платежів`
  if (mod10 === 1) return `${n} платіж`
  if (mod10 >= 2 && mod10 <= 4) return `${n} платежі`
  return `${n} платежів`
}

/** Parse ISO date string to YYYY-MM-DD for date input fields. */
export function toInputDate(dateStr: string): string {
  return dateStr.slice(0, 10)
}

/** Format today as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
