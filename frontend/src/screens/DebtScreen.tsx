import { useEffect, useState } from 'react'
import { summaryApi } from '../api/summary'
import { paymentsApi } from '../api/payments'
import { loansApi } from '../api/loans'
import { formatAmount, formatDate } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Summary, Loan } from '../api/types'

interface Props {
  onBack: () => void
  onCalendarClick: () => void
}

export function DebtScreen({ onBack, onCalendarClick }: Props) {
  useBackButton(onBack)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [totalPaid, setTotalPaid] = useState<string | null>(null)
  const [closingDate, setClosingDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, loans] = await Promise.all([
          summaryApi.get(),
          loansApi.list(),
        ])
        setSummary(s)

        // Total paid = sum of all actual payments across all active loans
        let paid = 0
        for (const loan of loans) {
          const pmts = await paymentsApi.list(loan.id)
          paid += pmts.reduce((acc, p) => acc + Number(p.actual_amount), 0)
        }
        setTotalPaid(paid.toFixed(2))

        // Closing date = max last schedule date across all loans
        let lastDate: string | null = null
        for (const loan of loans as (Loan & { schedule?: { date: string }[] })[]) {
          const detail = await loansApi.get(loan.id)
          if (detail.schedule && detail.schedule.length > 0) {
            const d = String(detail.schedule[detail.schedule.length - 1].date)
            if (!lastDate || d > lastDate) lastDate = d
          }
        }
        setClosingDate(lastDate)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner className="h-screen" />

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      {/* Header */}
      <div className="bg-white shadow-card-sm px-4 pt-4 pb-5">
        <h1 className="text-xl font-bold text-text-primary">Загальний борг</h1>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-4">
        {/* Total debt body */}
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-bold text-text-secondary tracking-widest mb-1">БОРГ (ТІЛО)</p>
          <p className="text-3xl font-bold text-text-primary">
            {summary ? formatAmount(summary.total_body) : '—'}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Без відсотків · {summary?.active_loan_count ?? 0} активних кредитів
          </p>
        </div>

        {/* Total with interest */}
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-bold text-text-secondary tracking-widest mb-1">РАЗОМ З ВІДСОТКАМИ</p>
          <p className="text-2xl font-bold text-text-primary">
            {summary ? formatAmount(summary.total_debt) : '—'}
          </p>
        </div>

        {/* Total paid */}
        <div className="bg-white rounded-card shadow-card px-5 py-4">
          <p className="text-xs font-bold text-text-secondary tracking-widest mb-1">УСЬОГО ВНЕСЕНО</p>
          <p className="text-2xl font-bold text-sage">
            {totalPaid ? formatAmount(totalPaid) : '—'}
          </p>
        </div>

        {/* Closing date */}
        {closingDate && (
          <div className="bg-white rounded-card shadow-card px-5 py-4">
            <p className="text-xs font-bold text-text-secondary tracking-widest mb-1">ДАТА ЗАКРИТТЯ ЗА ГРАФІКОМ</p>
            <p className="text-lg font-semibold text-text-primary">
              {formatDate(closingDate)}
            </p>
            {summary?.strategy !== 'none' && (
              <p className="text-xs text-text-secondary mt-1">
                Зі стратегією можна закрити раніше — дивись у вкладці «План»
              </p>
            )}
          </div>
        )}

        {/* Calendar button */}
        <button
          onClick={onCalendarClick}
          className="w-full bg-sage text-white font-semibold py-4 rounded-button
                     flex items-center justify-center gap-2 active:bg-sage-dark"
        >
          📅 Календар платежів
        </button>
      </div>
    </div>
  )
}
