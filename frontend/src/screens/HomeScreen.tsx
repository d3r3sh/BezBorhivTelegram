import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { LoanCard } from '../components/LoanCard'
import { loansApi } from '../api/loans'
import { summaryApi } from '../api/summary'
import { formatAmount } from '../utils/format'
import type { Loan } from '../api/types'
import type { Summary } from '../api/types'

interface Props {
  onAddLoan: () => void
  onLoanClick: (id: string) => void
  onStrategyClick: () => void
  onCalendarClick: () => void
}

export function HomeScreen({ onAddLoan, onLoanClick, onStrategyClick, onCalendarClick }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    try {
      setError(null)
      const [l, s] = await Promise.all([loansApi.list(), summaryApi.get()])
      setLoans(l)
      setSummary(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  if (loading) return <LoadingSpinner className="h-screen" />
  if (error) return (
    <div className="flex items-center justify-center h-screen px-6 text-center">
      <p className="text-terracotta">{error}</p>
    </div>
  )

  const totalLoans = loans.length

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-24">
      {/* Summary banner */}
      {summary && totalLoans > 0 && (
        <div className="bg-gradient-to-br from-sage to-sage-dark text-white px-5 pt-6 pb-8">
          <p className="text-sm opacity-80 mb-1">Загальний борг</p>
          <p className="text-3xl font-bold mb-4">{formatAmount(summary.total_debt)}</p>
          <div className="flex items-end justify-between">
            <div className="flex gap-4 text-sm">
              <div>
                <p className="opacity-70">Мінімальні</p>
                <p className="font-semibold">{formatAmount(summary.min_monthly)} / міс</p>
              </div>
              {summary.recommended_monthly && (
                <div>
                  <p className="opacity-70">Рекомендовані</p>
                  <p className="font-semibold">{formatAmount(summary.recommended_monthly)} / міс</p>
                </div>
              )}
            </div>
            <button
              onClick={onCalendarClick}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 active:bg-white/40
                         rounded-xl px-3 py-1.5 text-white text-xs font-medium transition-colors"
            >
              📅 Календар
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* Remaining this month */}
        {summary && totalLoans > 0 && (
          <div className="bg-white rounded-card shadow-card-sm px-4 py-3 flex justify-between items-center">
            <span className="text-text-secondary text-sm">Залишилось цього місяця</span>
            <span className="font-bold text-text-primary">
              {Number(summary.remaining_this_month) === 0
                ? 'Все внесено ✓'
                : formatAmount(summary.remaining_this_month)}
            </span>
          </div>
        )}

        {/* Strategy banner */}
        {summary?.strategy === 'none' && totalLoans >= 1 && (
          <button
            onClick={onStrategyClick}
            className="w-full text-left bg-sage-light border border-sage/30 rounded-card px-4 py-3 flex items-center justify-between"
          >
            <span className="text-sage font-semibold text-sm">
              🎯 Оберіть стратегію погашення
            </span>
            <span className="text-sage">→</span>
          </button>
        )}

        {/* Empty state */}
        {totalLoans === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="text-5xl">💸</span>
            <p className="text-text-secondary text-center">
              Ще немає кредитів.<br />Додайте перший!
            </p>
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
      </div>

      {/* FAB */}
      <button
        onClick={onAddLoan}
        className="fixed bottom-6 right-4 w-14 h-14 bg-sage rounded-full shadow-lg
                   text-white text-2xl flex items-center justify-center
                   active:scale-90 transition-transform"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        +
      </button>
    </div>
  )
}
