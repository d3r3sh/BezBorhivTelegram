import { useEffect, useMemo, useState } from 'react'
import { useBackButton } from '../hooks/useTelegram'
import { calendarApi } from '../api/calendar'
import { formatAmount } from '../utils/format'
import {
  getMonthGrid, addMonthsToYearMonth, groupEventsByDate, getLoanColor,
  toDateStr, MONTH_NAMES_UK, WEEKDAY_LABELS, PAID_COLOR, OVERDUE_COLOR,
} from '../utils/calendarUtils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { CalendarEvent, CalendarData } from '../api/types'

interface Props {
  onBack: () => void
  onLoanClick: (loanId: string) => void
}

const MONTHS_PER_LOAD = 24
const MAX_TOTAL_MONTHS = 240

interface MonthGridProps {
  year: number; month: number
  eventsByDate: Record<string, CalendarEvent[]>
  todayStr: string
  onDayClick: (events: CalendarEvent[]) => void
}

function MonthGrid({ year, month, eventsByDate, todayStr, onDayClick }: MonthGridProps) {
  const cells = getMonthGrid(year, month)
  return (
    <div className="flex-1 min-w-0">
      <p className="text-center font-semibold mb-1" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
        {MONTH_NAMES_UK[month - 1]}<br />
        <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{year}</span>
      </p>
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="text-center" style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{d}</div>
        ))}
      </div>
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
                className="flex items-center justify-center font-medium"
                style={{
                  fontSize: '10px', width: '18px', height: '18px',
                  color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                  outline: isToday ? '1.5px solid var(--accent)' : 'none',
                  borderRadius: '9999px',
                }}
              >
                {day}
              </span>
              {hasEvents && (
                <div className="flex items-center gap-px mt-px flex-wrap justify-center">
                  {shown.map((ev, i) => (
                    <span key={i} className="rounded-full flex-none" style={{
                      width: '5px', height: '5px',
                      backgroundColor: ev.is_paid ? PAID_COLOR : ev.is_overdue ? OVERDUE_COLOR : getLoanColor(ev.color_index),
                    }} />
                  ))}
                  {overflow > 0 && (
                    <span style={{ fontSize: '7px', lineHeight: '5px', color: 'var(--text-secondary)' }}>+{overflow}</span>
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

function DaySheet({ events, onClose, onLoanClick }: {
  events: CalendarEvent[]; onClose: () => void; onLoanClick: (id: string) => void
}) {
  const dateLabel = new Date(events[0].date + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full px-5 pt-3 pb-10"
        style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag indicator */}
        <div className="w-9 h-1 rounded-pill mx-auto mb-4" style={{ background: 'var(--divider)' }} />
        <p className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Платежі — {dateLabel}
        </p>
        <div className="flex flex-col gap-2">
          {events.map((ev, i) => (
            <button
              key={i}
              className="flex items-center justify-between px-4 py-3 rounded-card text-left w-full active:opacity-70"
              style={{ background: 'var(--bg)', boxShadow: '6px 6px 9px rgba(199,195,186,0.65), -6px -6px 9px rgba(253,251,246,1.0)' }}
              onClick={() => { onClose(); onLoanClick(ev.loan_id) }}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full flex-none" style={{ width: '10px', height: '10px', backgroundColor: getLoanColor(ev.color_index) }} />
                <span className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{ev.loan_name}</span>
              </div>
              <div className="text-right">
                <p className="text-[14px]" style={{ color: 'var(--text-primary)' }}>{formatAmount(ev.planned_amount)}</p>
                <p className="text-[12px] font-medium" style={{
                  color: ev.is_paid ? 'var(--sage)' : ev.is_overdue ? 'var(--terracotta)' : 'var(--text-secondary)'
                }}>
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

  useEffect(() => {
    setLoading(true)
    calendarApi.get(toDateStr(startYear, startMonth, 1), loadedMonths)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [loadedMonths, startYear, startMonth])

  const eventsByDate = useMemo(() => data ? groupEventsByDate(data.events) : {}, [data])

  const { year: m1Year, month: m1Month } = addMonthsToYearMonth(startYear, startMonth, pageIndex * 2)
  const { year: m2Year, month: m2Month } = addMonthsToYearMonth(startYear, startMonth, pageIndex * 2 + 1)

  const totalPages = Math.floor(loadedMonths / 2)
  const canGoNext = pageIndex < totalPages - 1 || loadedMonths < MAX_TOTAL_MONTHS
  const canGoPrev = pageIndex > 0

  const handleNext = () => {
    if (pageIndex < totalPages - 1) setPageIndex(p => p + 1)
    else if (loadedMonths < MAX_TOTAL_MONTHS) { setLoadedMonths(m => Math.min(m + MONTHS_PER_LOAD, MAX_TOTAL_MONTHS)); setPageIndex(p => p + 1) }
  }

  const handleDayClick = (events: CalendarEvent[]) => {
    if (events.length === 1) onLoanClick(events[0].loan_id)
    else setSheetEvents(events)
  }

  const currentMonthPrefix = toDateStr(startYear, startMonth, 1).slice(0, 7)
  const currentMonthEvents = useMemo(
    () => (data?.events ?? []).filter(ev => ev.date.startsWith(currentMonthPrefix)).sort((a, b) => a.date.localeCompare(b.date)),
    [data, currentMonthPrefix]
  )

  return (
    <div className="min-h-screen safe-top pb-8" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center px-5 pt-4 pb-3 gap-3">
        <button onClick={onBack} className="icon-btn w-[38px] h-[38px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          Календар
        </h1>
      </div>

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between px-4 py-2 mx-5 neu-raised rounded-card mb-3">
        <button
          onClick={() => setPageIndex(p => p - 1)}
          disabled={!canGoPrev}
          className="w-9 h-9 flex items-center justify-center text-[20px] disabled:opacity-25 active:opacity-60"
          style={{ color: 'var(--accent)' }}
        >‹</button>
        <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {MONTH_NAMES_UK[m1Month - 1]}{m1Year !== m2Year ? ` ${m1Year}` : ''} – {MONTH_NAMES_UK[m2Month - 1]} {m2Year}
        </span>
        <button
          onClick={handleNext}
          disabled={!canGoNext}
          className="w-9 h-9 flex items-center justify-center text-[20px] disabled:opacity-25 active:opacity-60"
          style={{ color: 'var(--accent)' }}
        >›</button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : error ? (
        <p className="text-center px-4 py-8" style={{ color: 'var(--terracotta)' }}>{error}</p>
      ) : (
        <>
          {/* ── Calendar grid ── */}
          <div className="neu-raised rounded-card mx-5 p-3 flex gap-2">
            <MonthGrid year={m1Year} month={m1Month} eventsByDate={eventsByDate} todayStr={todayStr} onDayClick={handleDayClick} />
            <div className="w-px" style={{ background: 'var(--divider)' }} />
            <MonthGrid year={m2Year} month={m2Month} eventsByDate={eventsByDate} todayStr={todayStr} onDayClick={handleDayClick} />
          </div>

          {/* ── Legend ── */}
          <div className="neu-raised rounded-card mx-5 mt-4 px-4 py-3">
            <div className="flex gap-4 mb-2 flex-wrap">
              {[
                { color: PAID_COLOR, label: 'Оплачено' },
                { color: OVERDUE_COLOR, label: 'Прострочено' },
                { color: 'var(--text-secondary)', label: 'Майбутній' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="rounded-full flex-none" style={{ width: '8px', height: '8px', backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            {(data?.active_loans ?? []).length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {(data?.active_loans ?? []).map(loan => (
                  <span key={loan.loan_id} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    <span className="rounded-full flex-none" style={{ width: '8px', height: '8px', backgroundColor: getLoanColor(loan.color_index) }} />
                    {loan.loan_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Current month list ── */}
          <div className="mx-5 mt-5">
            <p className="section-header">{MONTH_NAMES_UK[startMonth - 1]}</p>
            {currentMonthEvents.length === 0 ? (
              <p className="text-center py-6 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                Платежів у цьому місяці немає
              </p>
            ) : (
              <div className="neu-raised rounded-card overflow-hidden">
                {currentMonthEvents.map((ev, i) => (
                  <div key={`${ev.loan_id}-${i}`}>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full flex-none" style={{ width: '10px', height: '10px', backgroundColor: getLoanColor(ev.color_index) }} />
                        <div>
                          <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{ev.loan_name}</p>
                          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(ev.date + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatAmount(ev.planned_amount)}</p>
                        <p className="text-[12px] font-medium" style={{
                          color: ev.is_paid ? 'var(--sage)' : ev.is_overdue ? 'var(--terracotta)' : 'var(--text-secondary)'
                        }}>
                          {ev.is_paid ? 'Оплачено' : ev.is_overdue ? 'Прострочено' : 'Майбутній'}
                        </p>
                      </div>
                    </div>
                    {i < currentMonthEvents.length - 1 && (
                      <div style={{ height: 1, background: 'var(--divider)', margin: '0 20px' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
