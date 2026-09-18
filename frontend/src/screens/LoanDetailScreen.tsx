import { useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import WebApp from '@twa-dev/sdk'
import { loansApi } from '../api/loans'
import { paymentsApi } from '../api/payments'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { SegmentControl } from '../components/SegmentControl'
import { formatAmount, formatDate, formatShortDate } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { LoanDetail, Payment } from '../api/types'

const PALETTE = [
  '#4A90D9', '#9B59B6', '#E74C3C', '#1ABC9C',
  '#F39C12', '#2ECC71', '#E91E63', '#00BCD4',
  '#FF5722', '#795548',
]

interface Props {
  loanId: string
  onBack: () => void
  onRecordPayment: (loanId: string, initialType?: 'regular' | 'extra') => void
  onEditLoan: (loanId: string) => void
}

const today = new Date().toISOString().slice(0, 10)

export function LoanDetailScreen({ loanId, onBack, onRecordPayment, onEditLoan }: Props) {
  useBackButton(onBack)

  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [tab, setTab] = useState('schedule')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const reload = async () => {
    try {
      const [l, p] = await Promise.all([loansApi.get(loanId), paymentsApi.list(loanId)])
      setLoan(l); setPayments(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [loanId])

  const handleDelete = () => {
    setMenuOpen(false)
    WebApp.showConfirm(`Видалити кредит «${loan?.name}»? Всі платежі також будуть видалені.`, async (ok) => {
      if (!ok) return
      await loansApi.delete(loanId)
      onBack()
    })
  }

  const handleArchive = () => {
    setMenuOpen(false)
    WebApp.showConfirm(`Архівувати кредит «${loan?.name}»?`, async (ok) => {
      if (!ok) return
      await loansApi.archive(loanId)
      onBack()
    })
  }

  const handleDeletePayment = (p: Payment) => {
    const label = p.is_extra ? 'додатковий платіж' : `платіж від ${formatShortDate(p.actual_date!)}`
    WebApp.showConfirm(`Видалити ${label}?`, async (ok) => {
      if (!ok) return
      await paymentsApi.delete(loanId, p.id)
      reload()
    })
  }

  if (loading) return <LoadingSpinner className="h-screen" />
  if (error || !loan) return (
    <div className="flex items-center justify-center h-screen px-6 text-center">
      <p style={{ color: 'var(--terracotta)' }}>{error ?? 'Не знайдено'}</p>
    </div>
  )

  const balance = new Decimal(String(loan.current_balance))
  const initial = new Decimal(String(loan.initial_amount))
  const paid = initial.minus(balance)
  const pct = initial.isZero() ? 0 : paid.div(initial).mul(100).toNumber()
  const isPaidOff = balance.isZero()
  const loanColor = PALETTE[(loan.color_index - 1) % PALETTE.length]

  const paidRows = payments
    .filter(p => !p.is_extra && p.planned_date && p.actual_date)
    .sort((a, b) => (a.planned_date! > b.planned_date! ? 1 : -1))
    .map((p, i) => ({
      number: i + 1, date: String(p.planned_date),
      amount: String(p.planned_amount || p.actual_amount),
      balance: null as string | null,
      status: 'paid' as const, actualAmount: String(p.actual_amount),
    }))

  const futureRows = loan.schedule.map((s, i) => ({
    number: paidRows.length + i + 1, date: String(s.date),
    amount: String(s.amount), balance: String(s.balance),
    status: String(s.date) < today ? 'overdue' as const : 'future' as const,
    actualAmount: null as string | null,
  }))

  const fullSchedule = [...paidRows, ...futureRows]
  const visibleSchedule = showAll ? fullSchedule : fullSchedule.slice(0, 6)
  const closingDate = loan.schedule.length > 0 ? loan.schedule[loan.schedule.length - 1].date : null

  return (
    <div className="min-h-screen safe-top pb-8" style={{ background: 'var(--bg)' }}>

      {/* ── Color accent bar ── */}
      <div className="h-1 w-full" style={{ backgroundColor: loanColor }} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button onClick={onBack} className="icon-btn w-[38px] h-[38px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[17px] font-semibold truncate mx-3 flex-1 text-center" style={{ color: 'var(--text-primary)' }}>
          {loan.name}
        </span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="icon-btn w-[38px] h-[38px]"
          >
            <svg width="15" height="4" viewBox="0 0 20 4" fill="var(--text-primary)">
              <circle cx="2" cy="2" r="2" /><circle cx="10" cy="2" r="2" /><circle cx="18" cy="2" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-12 z-50 rounded-card overflow-hidden"
              style={{ background: 'var(--bg)', boxShadow: '7px 7px 10px rgba(199,195,186,0.75), -7px -7px 10px rgba(253,251,246,1.0)', minWidth: 180 }}
            >
              <button onClick={() => { setMenuOpen(false); onEditLoan(loanId) }}
                className="w-full text-left px-4 py-3 text-[14px] font-medium flex items-center gap-2 active:opacity-60"
                style={{ color: 'var(--text-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Редагувати
              </button>
              <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
              <button onClick={handleArchive}
                className="w-full text-left px-4 py-3 text-[14px] font-medium flex items-center gap-2 active:opacity-60"
                style={{ color: 'var(--text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/></svg>
                Архівувати
              </button>
              <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
              <button onClick={handleDelete}
                className="w-full text-left px-4 py-3 text-[14px] font-medium flex items-center gap-2 active:opacity-60"
                style={{ color: 'var(--terracotta)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Видалити
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* ── Balance card ── */}
        <div className="neu-raised rounded-card px-[20px] py-5 flex flex-col gap-3">
          <div>
            <p className="input-label mb-1">Загальний борг</p>
            <p className="text-[34px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
              {formatAmount(loan.current_balance)}
            </p>
          </div>

          {/* Progress bar with colored fill */}
          <div className="progress-track">
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: loanColor, boxShadow: `2px 2px 3px ${loanColor}80` }}
            />
          </div>
          <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            виплачено {pct.toFixed(0)}% · залишилось {loan.payments_remaining} платежів
          </p>

          {/* Body / principal */}
          <div className="neu-inset rounded-small px-4 py-3 flex justify-between items-center">
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Тіло кредиту</span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatAmount(loan.initial_amount)}
            </span>
          </div>
        </div>

        {/* ── Metric cards (2 columns) ── */}
        {!isPaidOff && (
          <div className="grid grid-cols-2 gap-3">
            <div className="neu-raised rounded-small px-[18px] py-4">
              <p className="input-label mb-1">Наступний платіж</p>
              <p className="text-[18px] font-bold" style={{ color: loan.is_overdue ? 'var(--terracotta)' : 'var(--text-primary)' }}>
                {formatAmount(loan.next_payment_amount ?? loan.monthly_payment)}
              </p>
            </div>
            <div className="neu-raised rounded-small px-[18px] py-4">
              <p className="input-label mb-1">Дата</p>
              <p className="text-[18px] font-bold" style={{ color: loan.is_overdue ? 'var(--terracotta)' : 'var(--text-primary)' }}>
                {loan.next_payment_date ? formatShortDate(loan.next_payment_date) : '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Closing forecast ── */}
        {closingDate && (
          <div className="neu-inset rounded-small px-4 py-3 flex justify-between items-center">
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Закриється</span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatDate(String(closingDate))}
            </span>
          </div>
        )}

        {/* ── Action buttons ── */}
        {!isPaidOff && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onRecordPayment(loanId, 'regular')}
              className="btn-primary"
            >
              Внести платіж
            </button>
            <button
              onClick={() => onRecordPayment(loanId, 'extra')}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Дострокове погашення
            </button>
          </div>
        )}

        {/* ── Schedule section ── */}
        <div>
          <p className="section-header">Платежі</p>
          <SegmentControl
            tabs={[{ value: 'schedule', label: 'Графік' }, { value: 'actual', label: 'Фактичні' }]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {/* Schedule tab */}
        {tab === 'schedule' && (
          <div className="neu-raised rounded-card overflow-hidden">
            {fullSchedule.length === 0 ? (
              <p className="text-center py-8 text-[14px]" style={{ color: 'var(--text-secondary)' }}>Немає платежів</p>
            ) : (
              <>
                {visibleSchedule.map((row, i) => (
                  <div key={`${row.status}-${row.number}`}>
                    <div className="flex items-center px-[18px] py-[14px] gap-3">
                      {/* Status circle */}
                      {row.status === 'paid' ? (
                        <div className="w-[22px] h-[22px] rounded-icon flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sage)' }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>
                        </div>
                      ) : row.status === 'overdue' ? (
                        <div className="w-[22px] h-[22px] rounded-icon flex items-center justify-center flex-shrink-0" style={{ background: 'var(--terracotta)' }}>
                          <span className="text-white text-[9px] font-bold">!</span>
                        </div>
                      ) : (
                        <div className="w-[22px] h-[22px] rounded-icon flex-shrink-0 neu-inset" />
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="text-[14px]" style={{ color: row.status === 'overdue' ? 'var(--terracotta)' : 'var(--text-primary)' }}>
                          Платіж {row.number} · {formatShortDate(row.date)}
                        </span>
                      </div>
                      <span className="text-[14px] font-semibold" style={{ color: row.status === 'overdue' ? 'var(--terracotta)' : 'var(--text-primary)' }}>
                        {formatAmount(row.actualAmount ?? row.amount)}
                      </span>
                    </div>
                    {i < visibleSchedule.length - 1 && (
                      <div style={{ height: 1, background: 'var(--divider)', margin: '0 18px' }} />
                    )}
                  </div>
                ))}
                {fullSchedule.length > 6 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3.5 text-[14px] font-semibold text-center"
                    style={{ color: 'var(--sage)', borderTop: '1px solid var(--divider)' }}
                  >
                    Показати всі {fullSchedule.length} платежів
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Actual tab */}
        {tab === 'actual' && (
          <div className="neu-raised rounded-card overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-center py-8 text-[14px]" style={{ color: 'var(--text-secondary)' }}>Ще немає оплат</p>
            ) : (
              payments.map((p, i) => (
                <div key={p.id}>
                  <div className="flex items-center px-[18px] py-3 gap-3">
                    <div
                      className="w-[28px] h-[28px] rounded-icon flex items-center justify-center flex-shrink-0"
                      style={{ background: p.is_extra ? 'var(--clay)' : 'var(--sage)' }}
                    >
                      {p.is_extra
                        ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
                        : <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="2 6 5 9 10 3"/></svg>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {p.actual_date ? formatShortDate(p.actual_date) : '—'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {p.is_extra ? 'Додатковий' : 'Плановий'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {formatAmount(p.actual_amount)}
                        </p>
                        {!p.is_extra && Number(p.planned_amount) > 0 && (
                          <DiffLabel actual={String(p.actual_amount)} planned={String(p.planned_amount)} />
                        )}
                      </div>
                      <button onClick={() => handleDeletePayment(p)} className="w-6 h-6 flex items-center justify-center active:opacity-60">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {i < payments.length - 1 && (
                    <div style={{ height: 1, background: 'var(--divider)', margin: '0 18px' }} />
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function DiffLabel({ actual, planned }: { actual: string; planned: string }) {
  const diff = new Decimal(actual).minus(new Decimal(planned))
  if (diff.isZero()) return null
  const positive = diff.gt(0)
  return (
    <span className="text-[11px] font-semibold" style={{ color: positive ? 'var(--sage)' : 'var(--terracotta)' }}>
      {positive ? '+' : '−'}{formatAmount(diff.abs().toString())}
    </span>
  )
}
