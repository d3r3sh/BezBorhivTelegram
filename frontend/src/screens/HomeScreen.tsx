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
  onCalendarClick, onDebtClick,
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
      <p style={{ color: 'var(--terracotta)' }}>{error}</p>
    </div>
  )

  const hasLoans = loans.length > 0
  const allPaid = summary ? Number(summary.remaining_this_month) === 0 : false

  return (
    <div className="min-h-screen screen-pt" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pb-2">
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          Мої кредити
        </h1>
        {hasLoans && (
          <button
            onClick={onAddLoan}
            className="icon-btn w-11 h-11 active:scale-95"
            aria-label="Додати кредит"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-5 pb-6 flex flex-col gap-5">

        {/* ── Summary Card (coral) ── */}
        {summary && hasLoans && (
          <button
            onClick={onDebtClick}
            className="w-full text-left rounded-banner px-[22px] py-6 active:scale-[0.98] transition-transform"
            style={{ background: 'var(--accent)', boxShadow: '5px 7px 10px rgba(216,90,48,0.45), -3px -3px 6px rgba(253,251,246,1.0)' }}
          >
            <p className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Загальний борг
            </p>
            <p className="text-[32px] font-bold leading-none mb-3" style={{ color: 'white' }}>
              {formatAmount(summary.total_debt)}
            </p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', marginBottom: 8 }} />
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.88)' }}>
              Мінімальні платежі на місяць · {formatAmount(summary.min_monthly)}
            </p>
            {summary.recommended_monthly && (
              <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.88)' }}>
                Рекомендовані платежі на місяць · {formatAmount(summary.recommended_monthly)}
              </p>
            )}
          </button>
        )}

        {/* ── Remaining this month ── */}
        {summary && hasLoans && (
          allPaid ? (
            <div className="neu-raised rounded-card px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Залишилось цього місяця
                </p>
                <p className="text-[17px] font-bold" style={{ color: 'var(--sage)' }}>
                  Цього місяця все внесено
                </p>
              </div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--sage)" className="flex-shrink-0 ml-3">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1.5 14.5-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/>
              </svg>
            </div>
          ) : (
            <div className="neu-raised rounded-card px-5 py-4 flex justify-between items-center">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Залишилось цього місяця
              </span>
              <span className="text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(summary.remaining_this_month)}
              </span>
            </div>
          )
        )}

        {/* ── Strategy banner ── */}
        {summary?.strategy === 'none' && loans.length >= 2 && (
          <button
            onClick={onStrategyClick}
            className="w-full text-left neu-raised rounded-card px-[18px] py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div
              className="w-10 h-10 rounded-icon flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(224,103,47,0.12)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Оберіть стратегію погашення
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                Закрийте борги швидше з планом
              </p>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* ── Calendar button (shown when has loans) ── */}
        {hasLoans && (
          <button
            onClick={onCalendarClick}
            className="w-full flex items-center gap-3 neu-raised rounded-card px-[18px] py-3.5 active:scale-[0.98] transition-transform"
          >
            <div
              className="w-10 h-10 rounded-icon flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(107,140,168,0.12)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
              Календар платежів
            </span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* ── Section header ── */}
        {hasLoans && (
          <p className="section-header mt-1">Мої кредити</p>
        )}

        {/* ── Empty state ── */}
        {!hasLoans && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div
              className="w-[110px] h-[110px] rounded-icon flex items-center justify-center"
              style={{ boxShadow: '8px 8px 14px rgba(199,195,186,0.75), -8px -8px 14px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-serif font-semibold text-[24px] mb-2" style={{ color: 'var(--text-primary)' }}>
                Немає кредитів
              </p>
              <p className="text-[15px] max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
                Додайте перший кредит, щоб почати відстежувати свої виплати
              </p>
            </div>
            <button
              onClick={onAddLoan}
              className="btn-accent rounded-button px-10 py-4 text-[15px] font-bold"
              style={{ background: 'var(--accent)', color: 'white', boxShadow: '5px 7px 10px rgba(216,90,48,0.45), -3px -3px 6px rgba(253,251,246,1.0)', borderRadius: 18 }}
            >
              + Додати кредит
            </button>
          </div>
        )}

        {/* ── Loan list ── */}
        {loans.map(loan => (
          <LoanCard
            key={loan.id}
            loan={loan}
            onClick={() => onLoanClick(loan.id)}
          />
        ))}

      </div>
    </div>
  )
}
