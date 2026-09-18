import Decimal from 'decimal.js'
import { ProgressBar } from './ProgressBar'
import { formatAmount, formatShortDate } from '../utils/format'
import type { Loan } from '../api/types'

const PALETTE = [
  '#5C8A6B', '#C4664A', '#4A90D9', '#D4896E',
  '#7B68EE', '#2ECC71', '#E74C3C', '#F39C12',
  '#1ABC9C', '#9B59B6',
]

interface Props {
  loan: Loan
  onClick: () => void
}

export function LoanCard({ loan, onClick }: Props) {
  const balance = new Decimal(String(loan.current_balance))
  const initial = new Decimal(String(loan.initial_amount))
  const paid = initial.minus(balance)
  const pct = initial.isZero() ? 0 : paid.div(initial).mul(100).toNumber()

  const color = PALETTE[(loan.color_index - 1) % PALETTE.length]
  const isOverdue = loan.is_overdue

  return (
    <button
      className={`w-full text-left bg-white rounded-card shadow-card p-4 flex flex-col gap-3
                  active:scale-[0.98] transition-transform
                  ${isOverdue ? 'border-l-4 border-terracotta' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-text-primary truncate text-[15px]">{loan.name}</span>
        </div>
        {isOverdue && (
          <span className="text-xs font-bold text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full flex-shrink-0">
            Прострочено
          </span>
        )}
      </div>

      {/* Total debt */}
      <div className="text-2xl font-bold text-text-primary tracking-tight">
        {formatAmount(loan.total_debt)}
      </div>

      {/* Progress */}
      <ProgressBar percent={pct} />

      {/* Footer */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-1.5">
          {loan.next_payment_date ? (
            <>
              <span className={`font-semibold ${isOverdue ? 'text-terracotta' : 'text-text-primary'}`}>
                {formatAmount(loan.next_payment_amount ?? loan.monthly_payment)}
              </span>
              <span className="text-text-secondary">·</span>
              <span className={`${isOverdue ? 'text-terracotta' : 'text-text-secondary'}`}>
                {formatShortDate(loan.next_payment_date)}
              </span>
            </>
          ) : (
            <span className="text-green-600 font-semibold text-sm">Виплачено ✓</span>
          )}
        </div>
        <span className="text-text-secondary text-xs">
          {loan.payments_made} з {loan.payments_made + loan.payments_remaining}
        </span>
      </div>
    </button>
  )
}
