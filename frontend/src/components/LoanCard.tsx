import Decimal from 'decimal.js'
import { ProgressBar } from './ProgressBar'
import { formatAmount, formatShortDate } from '../utils/format'
import type { Loan } from '../api/types'

interface Props {
  loan: Loan
  onClick: () => void
}

export function LoanCard({ loan, onClick }: Props) {
  const balance = new Decimal(String(loan.current_balance))
  const initial = new Decimal(String(loan.initial_amount))
  const paid = initial.minus(balance)
  const pct = initial.isZero() ? 0 : paid.div(initial).mul(100).toNumber()
  const total = loan.payments_made + loan.payments_remaining

  const isOverdue = loan.is_overdue

  return (
    <button
      className="w-full text-left rounded-card p-[20px] flex flex-col gap-3 active:scale-[0.98] transition-transform"
      style={isOverdue ? {
        background: 'rgba(196,100,74,0.08)',
        border: '2px solid rgba(196,100,74,0.5)',
        boxShadow: '7px 7px 10px rgba(199,195,186,0.75), -7px -7px 10px rgba(253,251,246,1.0)',
      } : {
        background: 'var(--bg)',
        boxShadow: '7px 7px 10px rgba(199,195,186,0.75), -7px -7px 10px rgba(253,251,246,1.0)',
      }}
      onClick={onClick}
    >
      {/* Row 1: name + overdue badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
          {loan.name}
        </span>
        {isOverdue && (
          <span className="badge-overdue flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--terracotta)">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 5v6m0 3v1"/>
            </svg>
            Прострочено
          </span>
        )}
      </div>

      {/* Row 2: total debt */}
      <div className="text-[26px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
        {formatAmount(loan.total_debt)}
      </div>

      {/* Row 3: progress */}
      <ProgressBar percent={pct} overdue={isOverdue} />

      {/* Row 4: payments count + next payment */}
      <div className="flex justify-between items-center">
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {loan.payments_made} з {total} платежів
        </span>
        <span className="text-[12px]" style={{ color: isOverdue ? 'var(--terracotta)' : 'var(--text-secondary)' }}>
          {loan.next_payment_date
            ? `${formatAmount(loan.next_payment_amount ?? loan.monthly_payment)} · ${formatShortDate(loan.next_payment_date)}`
            : <span style={{ color: 'var(--sage)', fontWeight: 600 }}>Виплачено ✓</span>
          }
        </span>
      </div>
    </button>
  )
}
