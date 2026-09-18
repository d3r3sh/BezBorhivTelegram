import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { LoanCard } from '../components/LoanCard'
import { loansApi } from '../api/loans'
import { summaryApi } from '../api/summary'
import { formatAmount } from '../utils/format'
import type { Loan, Summary } from '../api/types'

interface Props {
  onAddLoan: () => void
  onLoanClick: (id: string) => void
  onStrategyClick: () => void
  onCalendarClick: () => void
  onDebtClick: () => void
  onArchiveClick: () => void
}

export function HomeScreen({
  onAddLoan, onLoanClick, onStrategyClick,
  onCalendarClick, onDebtClick, onArchiveClick,
}: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loansApi.list(), summaryApi.get()])
      .then(([l, s]) => { setLoans(l); setSummary(s) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner className="h-screen" />
  if (error) return (
    <div className="flex items-center justify-center h-screen px-6 text-center">
      <p className="text-terracotta">{error}</p>
    </div>
  )

  const hasLoans = loans.length > 0

  return (
    <div className="min-h-screen bg-cream safe-top">

      {/* ── Summary banner ── */}
      {summary && hasLoans && (
        <div
          className="bg-gradient-to-br from-sage to-sage-dark text-white px-5 pt-8 pb-6 cursor-pointer active:opacity-90"
          onClick={onDebtClick}
        >
          <p className="text-sm opacity-75 mb-1 font-medium tracking-wide">Загальний борг</p>
          <p className="text-4xl font-bold mb-5 tracking-tight">
            {formatAmount(summary.total_debt)}
          </p>

          <div className="flex gap-6 text-sm">
            <div>
              <p className="opacity-60 text-xs mb-0.5">Мінімальні / міс</p>
              <p className="font-bold">{formatAmount(summary.min_monthly)}</p>
            </div>
            {summary.recommended_monthly && (
              <div>
                <p className="opacity-60 text-xs mb-0.5">Рекомендовані / міс</p>
                <p className="font-bold">{formatAmount(summary.recommended_monthly)}</p>
              </div>
            )}
          </div>

          {/* Quick actions row */}
          <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={onCalendarClick}
              className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5 text-white text-xs font-semibold active:bg-white/30"
            >
              📅 Календар
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-6 flex flex-col gap-3">

        {/* Remaining this month */}
        {summary && hasLoans && (
          <div className="bg-white rounded-card shadow-card-sm px-4 py-3.5 flex justify-between items-center">
            <span className="text-text-secondary text-sm">Залишилось цього місяця</span>
            <span className={`font-bold text-sm ${
              Number(summary.remaining_this_month) === 0
                ? 'text-green-600'
                : 'text-text-primary'
            }`}>
              {Number(summary.remaining_this_month) === 0
                ? 'Все внесено ✓'
                : formatAmount(summary.remaining_this_month)}
            </span>
          </div>
        )}

        {/* Strategy banner */}
        {summary?.strategy === 'none' && hasLoans && (
          <button
            onClick={onStrategyClick}
            className="w-full text-left bg-sage-light border border-sage/30 rounded-card px-4 py-3.5 flex items-center justify-between active:bg-sage-light/70"
          >
            <div>
              <p className="text-sage font-semibold text-sm">🎯 Оберіть стратегію погашення</p>
              <p className="text-sage/70 text-xs mt-0.5">Закрийте борги швидше з планом</p>
            </div>
            <span className="text-sage text-lg">›</span>
          </button>
        )}

        {/* Empty state */}
        {!hasLoans && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="text-6xl">💳</span>
            <div className="text-center">
              <p className="font-semibold text-text-primary mb-1">Ще немає кредитів</p>
              <p className="text-text-secondary text-sm">Додайте перший кредит, щоб почати</p>
            </div>
            <button
              onClick={onAddLoan}
              className="mt-2 bg-sage text-white font-semibold px-8 py-3 rounded-button text-sm active:bg-sage-dark"
            >
              Додати кредит
            </button>
          </div>
        )}

        {/* Loan list */}
        {loans.map(loan => (
          <LoanCard
            key={loan.id}
            loan={loan}
            onClick={() => onLoanClick(loan.id)}
          />
        ))}

        {/* Archive link */}
        {hasLoans && (
          <button
            onClick={onArchiveClick}
            className="w-full text-center text-text-secondary text-sm py-3 active:text-text-primary"
          >
            📦 Архів закритих кредитів
          </button>
        )}
      </div>

      {/* FAB — positioned above tab bar */}
      {hasLoans && (
        <button
          onClick={onAddLoan}
          className="fixed right-4 w-14 h-14 bg-sage rounded-full shadow-lg
                     text-white text-2xl flex items-center justify-center
                     active:scale-90 transition-transform z-30"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          +
        </button>
      )}
    </div>
  )
}
