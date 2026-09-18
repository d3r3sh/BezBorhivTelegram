import { useEffect, useMemo, useState } from 'react'
import { useBackButton } from '../hooks/useTelegram'
import { calendarApi } from '../api/calendar'
import { formatAmount } from '../utils/format'
import {
  getMonthGrid,
  addMonthsToYearMonth,
  groupEventsByDate,
  getLoanColor,
  toDateStr,
  MONTH_NAMES_UK,
  WEEKDAY_LABELS,
  PAID_COLOR,
  OVERDUE_COLOR,
} from '../utils/calendarUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { CalendarEvent, CalendarData } from '../api/types'

interface Props {
  onBack: () => void
  onLoanClick: (loanId: string) => void
}

const MONTHS_PER_LOAD = 24
const MAX_TOTAL_MONTHS = 240 // 20 years

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MonthGridProps {
  year: number
  month: number
  eventsByDate: Record<string, CalendarEvent[]>
  todayStr: string
  onDayClick: (events: CalendarEvent[]) => void
}

function MonthGrid({ year, month, eventsByDate, todayStr, onDayClick }: MonthGridProps) {
  const cells = getMonthGrid(year, month)

  return (
    <div className="flex-1 min-w-0">
      <p className="text-center font-semibold text-text-primary mb-1" style={{ fontSize: '11px' }}>
        {MONTH_NAMES_UK[month - 1]}<br />
        <span className="font-normal text-text-secondary">{year}</span>
      </p>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="text-center text-text-secondary" style={{ fontSize: '9px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`null-${idx}`} />

          const dateStr = toDateStr(year, month, day)
          const isToday = dateStr === todayStr
          const events = eventsByDate[dateStr] ?? []
          const hasEvents = events.length > 0
          const shown = events.slice(0, 3)
          const overflow = events.length - 3

          return (
            <div
              key={dateStr}
              className={`flex flex-col items-center pb-0.5 ${hasEvents ? 'cursor-pointer active:opacity-60' : ''}`}
              onClick={() => hasEvents && onDayClick(events)}
            >
              <span
                className={`flex items-center justify-center font-medium ${
                  isToday
                    ? 'ring-1 ring-sage rounded-full text-sage'
                    : 'text-text-primary'
                }`}
                style={{
                  fontSize: '10px',
                  width: '18px',
                  height: '18px',
                }}
              >
                {day}
              </span>

              {hasEvents && (
                <div className="flex items-center gap-px mt-px flex-wrap justify-center">
                  {shown.map((ev, i) => (
                    <span
                      key={i}
                      className="rounded-full flex-none"
                      style={{
                        width: '5px',
                        height: '5px',
                        backgroundColor: ev.is_paid
                          ? PAID_COLOR
                          : ev.is_overdue
                          ? OVERDUE_COLOR
                          : getLoanColor(ev.color_index),
                      }}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-text-secondary" style={{ fontSize: '7px', lineHeight: '5px' }}>
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface DaySheetProps {
  events: CalendarEvent[]
  onClose: () => void
  onLoanClick: (id: string) => void
}

function DaySheet({ events, onClose, onLoanClick }: DaySheetProps) {
  const dateLabel = new Date(events[0].date + 'T00:00:00').toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full rounded-t-3xl px-4 pt-3 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
        <p className="text-sm font-semibold text-text-primary mb-3">
          Платежі — {dateLabel}
        </p>
        <div className="flex flex-col gap-2">
          {events.map((ev, i) => (
            <button
              key={i}
              className="flex items-center justify-between p-3 bg-cream rounded-2xl text-left w-full active:opacity-70"
              onClick={() => { onClose(); onLoanClick(ev.loan_id) }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full flex-none"
                  style={{ width: '10px', height: '10px', backgroundColor: getLoanColor(ev.color_index) }}
                />
                <span className="text-sm font-medium text-text-primary">{ev.loan_name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-primary">{formatAmount(ev.planned_amount)}</p>
                <p className={`text-xs font-medium ${
                  ev.is_paid ? 'text-green-600'
                  : ev.is_overdue ? 'text-terracotta'
                  : 'text-text-secondary'
                }`}>
                  {ev.is_paid ? 'Оплачено' : ev.is_overdue ? 'Прострочено' : 'Майбутній'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function CalendarScreen({ onBack, onLoanClick }: Props) {
  useBackButton(onBack)

  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedMonths, setLoadedMonths] = useState(MONTHS_PER_LOAD)
  const [pageIndex, setPageIndex] = useState(0)
  const [sheetEvents, setSheetEvents] = useState<CalendarEvent[] | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today])
  const startYear = today.getFullYear()
  const startMonth = today.getMonth() + 1

  // Load calendar data whenever loadedMonths changes
  useEffect(() => {
    setLoading(true)
    const fromDate = toDateStr(startYear, startMonth, 1)
    calendarApi
      .get(fromDate, loadedMonths)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [loadedMonths, startYear, startMonth])

  const eventsByDate = useMemo(
    () => (data ? groupEventsByDate(data.events) : {}),
    [data],
  )

  // Current page months
  const { year: m1Year, month: m1Month } = addMonthsToYearMonth(startYear, startMonth, pageIndex * 2)
  const { year: m2Year, month: m2Month } = addMonthsToYearMonth(startYear, startMonth, pageIndex * 2 + 1)

  // Navigation limits
  const totalPages = Math.floor(loadedMonths / 2)
  const canGoNext = pageIndex < totalPages - 1 || loadedMonths < MAX_TOTAL_MONTHS
  const canGoPrev = pageIndex > 0

  const handleNext = () => {
    if (pageIndex < totalPages - 1) {
      setPageIndex(p => p + 1)
    } else if (loadedMonths < MAX_TOTAL_MONTHS) {
      setLoadedMonths(m => Math.min(m + MONTHS_PER_LOAD, MAX_TOTAL_MONTHS))
      setPageIndex(p => p + 1)
    }
  }

  const handleDayClick = (events: CalendarEvent[]) => {
    if (events.length === 1) {
      onLoanClick(events[0].loan_id)
    } else {
      setSheetEvents(events)
    }
  }

  // Current month payments list (always current month, not visible page)
  const currentMonthPrefix = toDateStr(startYear, startMonth, 1).slice(0, 7)
  const currentMonthEvents = useMemo(
    () =>
      (data?.events ?? [])
        .filter(ev => ev.date.startsWith(currentMonthPrefix))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data, currentMonthPrefix],
  )

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-text-primary">Календар платежів</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
        <button
          onClick={() => setPageIndex(p => p - 1)}
          disabled={!canGoPrev}
          className="w-9 h-9 flex items-center justify-center text-sage text-xl disabled:opacity-25"
          aria-label="Попередня пара місяців"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-text-primary">
          {MONTH_NAMES_UK[m1Month - 1]}
          {m1Year !== m2Year ? ` ${m1Year}` : ''}
          {' – '}
          {MONTH_NAMES_UK[m2Month - 1]} {m2Year}
        </span>
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="w-9 h-9 flex items-center justify-center text-sage text-xl disabled:opacity-25"
          aria-label="Наступна пара місяців"
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : error ? (
        <p className="text-center text-terracotta px-4 py-8">{error}</p>
      ) : (
        <>
          <div className="flex gap-1 px-2 pt-2">
            <MonthGrid
              year={m1Year}
              month={m1Month}
              eventsByDate={eventsByDate}
              todayStr={todayStr}
              onDayClick={handleDayClick}
            />
            <div className="w-px bg-gray-200 flex-none" />
            <MonthGrid
              year={m2Year}
              month={m2Month}
              eventsByDate={eventsByDate}
              todayStr={todayStr}
              onDayClick={handleDayClick}
            />
          </div>

          {/* Legend */}
          <div className="mx-3 mt-3 p-3 bg-white rounded-card shadow-card-sm">
            {/* Status row */}
            <div className="flex gap-4 mb-2">
              {[
                { color: '#22C55E', label: 'Оплачено' },
                { color: '#5C8A6B', label: 'Майбутній' },
                { color: '#F97316', label: 'Прострочено' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-xs text-text-secondary">
                  <span className="rounded-full flex-none" style={{ width: '8px', height: '8px', backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            {/* Loans row */}
            {(data?.active_loans ?? []).length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(data?.active_loans ?? []).map(loan => (
                  <span key={loan.loan_id} className="flex items-center gap-1 text-xs text-text-primary">
                    <span
                      className="rounded-full flex-none"
                      style={{ width: '8px', height: '8px', backgroundColor: getLoanColor(loan.color_index) }}
                    />
                    {loan.loan_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current month payment list */}
          <div className="mx-3 mt-4">
            <p className="text-xs font-bold text-text-secondary tracking-widest mb-2 px-1">
              {MONTH_NAMES_UK[startMonth - 1].toUpperCase()}
            </p>
            {currentMonthEvents.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">
                Платежів у цьому місяці немає
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {currentMonthEvents.map((ev, i) => (
                  <div
                    key={`${ev.loan_id}-${i}`}
                    className="bg-white rounded-card shadow-card-sm px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full flex-none"
                        style={{ width: '10px', height: '10px', backgroundColor: getLoanColor(ev.color_index) }}
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{ev.loan_name}</p>
                        <p className="text-xs text-text-secondary">
                          {new Date(ev.date + 'T00:00:00').toLocaleDateString('uk-UA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">{formatAmount(ev.planned_amount)}</p>
                      <p className={`text-xs font-medium ${
                        ev.is_paid ? 'text-green-600'
                        : ev.is_overdue ? 'text-terracotta'
                        : 'text-text-secondary'
                      }`}>
                        {ev.is_paid ? 'Оплачено' : ev.is_overdue ? 'Прострочено' : 'Майбутній'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Day bottom sheet */}
      {sheetEvents && (
        <DaySheet
          events={sheetEvents}
          onClose={() => setSheetEvents(null)}
          onLoanClick={id => { setSheetEvents(null); onLoanClick(id) }}
        />
      )}
    </div>
  )
}
