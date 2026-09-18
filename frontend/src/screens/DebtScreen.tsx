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
        const [s, loans] = await Promise.all([summaryApi.get(), loansApi.list()])
        setSummary(s)

        let paid = 0
        for (const loan of loans) {
          const pmts = await paymentsApi.list(loan.id)
          paid += pmts.reduce((acc, p) => acc + Number(p.actual_amount), 0)
        }
        setTotalPaid(paid.toFixed(2))

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
    <div className="min-h-screen safe-top pb-8" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center px-5 pt-4 pb-4 gap-3">
        <button onClick={onBack} className="icon-btn w-[38px] h-[38px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          Загальний борг
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Total debt */}
        <div className="neu-raised rounded-card px-5 py-5">
          <p className="input-label mb-1">Загальний борг</p>
          <p className="text-[34px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
            {summary ? formatAmount(summary.total_debt) : '—'}
          </p>
          <div style={{ height: 1, background: 'var(--divider)', margin: '12px 0 10px' }} />
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Тіло боргу</span>
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {summary ? formatAmount(summary.total_body) : '—'}
            </span>
          </div>
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            {summary?.active_loan_count ?? 0} активних кредитів
          </p>
        </div>

        {/* Total paid */}
        <div className="neu-raised rounded-card px-5 py-4">
          <p className="input-label mb-1">Усього внесено</p>
          <p className="text-[26px] font-bold" style={{ color: 'var(--sage)' }}>
            {totalPaid ? formatAmount(totalPaid) : '—'}
          </p>
        </div>

        {/* Closing date */}
        {closingDate ? (
          <div className="neu-raised rounded-card px-5 py-4">
            <p className="input-label mb-1">Закриєте всі кредити</p>
            <p className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatDate(closingDate)}
            </p>
            {summary?.strategy !== 'none' && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                Зі стратегією можна закрити раніше — дивись у «Плані»
              </p>
            )}
          </div>
        ) : (
          <div className="neu-raised rounded-card px-5 py-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-icon flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(107,140,168,0.12)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Оберіть стратегію
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Щоб дізнатись дату закриття всіх боргів
              </p>
            </div>
          </div>
        )}

        {/* Calendar button */}
        <button onClick={onCalendarClick} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Календар платежів
        </button>

      </div>
    </div>
  )
}
