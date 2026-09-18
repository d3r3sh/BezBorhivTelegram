import { useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import WebApp from '@twa-dev/sdk'
import { loansApi } from '../api/loans'
import { paymentsApi } from '../api/payments'
import { ProgressBar } from '../components/ProgressBar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { formatAmount, formatDate, formatShortDate } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { LoanDetail, Payment } from '../api/types'

type Tab = 'schedule' | 'actual'

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
  const [tab, setTab] = useState<Tab>('schedule')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const reload = async () => {
    try {
      const [l, p] = await Promise.all([
        loansApi.get(loanId),
        paymentsApi.list(loanId),
      ])
      setLoan(l)
      setPayments(p)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [loanId])

  const handleDelete = () => {
    WebApp.showConfirm(
      `Видалити кредит «${loan?.name}»? Всі платежі також будуть видалені.`,
      async (ok) => {
        if (!ok) return
        await loansApi.delete(loanId)
        onBack()
      }
    )
  }

  const handleArchive = () => {
    WebApp.showConfirm(
      `Архівувати кредит «${loan?.name}»?`,
      async (ok) => {
        if (!ok) return
        await loansApi.archive(loanId)
        onBack()
      }
    )
  }

  const handleDeletePayment = (p: Payment) => {
    const label = p.is_extra ? 'додатковий платіж' : `платіж від ${formatShortDate(p.actual_date!)}`
    WebApp.showConfirm(
      `Видалити ${label}?`,
      async (ok) => {
        if (!ok) return
        await paymentsApi.delete(loanId, p.id)
        reload()
      }
    )
  }

  if (loading) return <LoadingSpinner className="h-screen" />
  if (error || !loan) return (
    <div className="flex items-center justify-center h-screen px-6 text-center">
      <p className="text-terracotta">{error ?? 'Не знайдено'}</p>
    </div>
  )

  const balance = new Decimal(String(loan.current_balance))
  const initial = new Decimal(String(loan.initial_amount))
  const paid = initial.minus(balance)
  const pct = initial.isZero() ? 0 : paid.div(initial).mul(100).toNumber()
  const isPaidOff = balance.isZero()

  // Build full schedule: paid rows + future/overdue rows
  const paidRows = payments
    .filter(p => !p.is_extra && p.planned_date && p.actual_date)
    .sort((a, b) => (a.planned_date! > b.planned_date! ? 1 : -1))
    .map((p, i) => ({
      number: i + 1,
      date: String(p.planned_date),
      amount: String(p.planned_amount || p.actual_amount),
      balance: null as string | null,
      status: 'paid' as const,
      actualAmount: String(p.actual_amount),
    }))

  const futureRows = loan.schedule.map((s, i) => ({
    number: paidRows.length + i + 1,
    date: String(s.date),
    amount: String(s.amount),
    balance: String(s.balance),
    status: String(s.date) < today ? 'overdue' as const : 'future' as const,
    actualAmount: null as string | null,
  }))

  const fullSchedule = [...paidRows, ...futureRows]
  const visibleSchedule = showAll ? fullSchedule : fullSchedule.slice(0, 6)

  const closingDate = loan.schedule.length > 0
    ? loan.schedule[loan.schedule.length - 1].date
    : null

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      {/* Header */}
      <div className="bg-white shadow-card-sm px-4 pt-4 pb-5">
        <h1 className="text-lg font-bold text-text-primary mb-1">{loan.name}</h1>

        {isPaidOff ? (
          <p className="text-sage font-semibold text-lg">Виплачено 100% ✓</p>
        ) : (
          <>
            <p className="text-2xl font-bold text-text-primary mb-2">
              {formatAmount(loan.current_balance)}
            </p>
            <ProgressBar percent={pct} />
            <div className="flex justify-between mt-1 text-xs text-text-secondary">
              <span>{loan.payments_made} з {loan.payments_made + loan.payments_remaining} платежів</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
          </>
        )}

        {loan.next_payment_date && !isPaidOff && (
          <div className="mt-3 text-sm text-text-secondary">
            Наступний:{' '}
            <strong className="text-text-primary">
              {formatAmount(loan.next_payment_amount ?? loan.monthly_payment)}
            </strong>
            {' · '}
            {formatShortDate(loan.next_payment_date)}
          </div>
        )}

        {/* Forecast closure — FR-DET-5 */}
        {closingDate && !isPaidOff && (
          <div className="mt-2 text-xs text-text-secondary">
            Закриється:{' '}
            <span className="text-text-primary font-medium">{formatDate(closingDate)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isPaidOff && (
        <div className="px-4 pt-4 flex gap-2">
          <button
            onClick={() => onRecordPayment(loanId, 'regular')}
            className="flex-1 bg-sage text-white font-semibold py-3 rounded-button text-sm active:bg-sage-dark"
          >
            💳 Внести платіж
          </button>
          <button
            onClick={() => onRecordPayment(loanId, 'extra')}
            className="bg-white border border-sage text-sage font-semibold py-3 px-4 rounded-button text-sm active:bg-sage-light"
          >
            + Додатково
          </button>
          <button
            onClick={() => onEditLoan(loanId)}
            className="bg-white border border-gray-200 text-text-primary font-semibold py-3 px-4 rounded-button text-sm"
          >
            ✏️
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex bg-white rounded-button p-1 shadow-card-sm">
          <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')}>
            Графік платежів
          </TabBtn>
          <TabBtn active={tab === 'actual'} onClick={() => setTab('actual')}>
            Фактичні оплати
          </TabBtn>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-3">
        {tab === 'schedule' && (
          <div className="bg-white rounded-card shadow-card-sm overflow-hidden">
            {fullSchedule.length === 0 ? (
              <p className="text-text-secondary text-sm text-center py-8">Немає платежів</p>
            ) : (
              <>
                {visibleSchedule.map((row, i) => (
                  <div key={`${row.status}-${row.number}`}>
                    <div className={`flex items-center px-4 py-3 text-sm gap-2
                      ${row.status === 'overdue' ? 'bg-terracotta/5' : ''}`}
                    >
                      {/* Status icon */}
                      <div className="w-5 flex-none text-center">
                        {row.status === 'paid' && (
                          <span className="text-green-500 font-bold">✓</span>
                        )}
                        {row.status === 'overdue' && (
                          <span className="text-terracotta font-bold text-xs">!</span>
                        )}
                        {row.status === 'future' && (
                          <span className="text-text-secondary text-xs">{row.number}</span>
                        )}
                      </div>

                      {/* Date */}
                      <div className={`text-xs w-14 flex-none ${
                        row.status === 'paid' ? 'text-text-secondary line-through'
                        : row.status === 'overdue' ? 'text-terracotta'
                        : 'text-text-secondary'
                      }`}>
                        {formatShortDate(row.date)}
                      </div>

                      {/* Amount */}
                      <div className={`flex-1 font-semibold ${
                        row.status === 'paid' ? 'text-green-600'
                        : row.status === 'overdue' ? 'text-terracotta'
                        : 'text-text-primary'
                      }`}>
                        {formatAmount(row.status === 'paid' && row.actualAmount
                          ? row.actualAmount
                          : row.amount)}
                      </div>

                      {/* Balance or diff */}
                      {row.status === 'paid' ? (
                        <span className="text-xs text-green-500 font-medium">Оплачено</span>
                      ) : row.balance ? (
                        <div className="text-text-secondary text-xs w-20 text-right">
                          /{formatAmount(row.balance)}
                        </div>
                      ) : null}
                    </div>
                    {i < visibleSchedule.length - 1 && (
                      <div className="border-b border-gray-100 mx-4" />
                    )}
                  </div>
                ))}
                {fullSchedule.length > 6 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 text-sage text-sm font-semibold border-t border-gray-100"
                  >
                    Показати всі {fullSchedule.length} платежів
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'actual' && (
          <div className="bg-white rounded-card shadow-card-sm overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-text-secondary text-sm text-center py-8">
                Ще немає оплат
              </p>
            ) : (
              payments.map((p, i) => (
                <div key={p.id}>
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-text-primary">
                        {formatAmount(p.actual_amount)}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {p.actual_date ? formatShortDate(p.actual_date) : '—'}
                        {p.is_extra && (
                          <span className="ml-2 text-sage font-medium">Додатковий</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!p.is_extra && Number(p.planned_amount) > 0 && (
                        <DiffLabel
                          actual={String(p.actual_amount)}
                          planned={String(p.planned_amount)}
                        />
                      )}
                      <button
                        onClick={() => handleDeletePayment(p)}
                        className="text-text-secondary text-lg leading-none active:text-terracotta"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {i < payments.length - 1 && (
                    <div className="border-b border-gray-100 mx-4" />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="px-4 pt-6 flex gap-3">
        {!isPaidOff && (
          <button
            onClick={handleArchive}
            className="flex-1 text-sm text-text-secondary border border-gray-200 rounded-button py-2.5"
          >
            Архівувати
          </button>
        )}
        <button
          onClick={handleDelete}
          className="flex-1 text-sm text-terracotta border border-terracotta/40 rounded-button py-2.5"
        >
          Видалити
        </button>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors
        ${active ? 'bg-sage text-white' : 'text-text-secondary'}`}
    >
      {children}
    </button>
  )
}

function DiffLabel({ actual, planned }: { actual: string; planned: string }) {
  const diff = new Decimal(actual).minus(new Decimal(planned))
  if (diff.isZero()) return null
  const positive = diff.gt(0)
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-sage' : 'text-terracotta'}`}>
      {positive ? '+' : '−'}{formatAmount(diff.abs().toString())}
    </span>
  )
}
