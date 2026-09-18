import { useState } from 'react'
import Decimal from 'decimal.js'
import WebApp from '@twa-dev/sdk'
import { paymentsApi } from '../api/payments'
import { loansApi } from '../api/loans'
import { formatAmount, todayISO } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { Loan } from '../api/types'

type PaymentType = 'regular' | 'extra'

interface Props {
  loanId: string
  initialType?: PaymentType
  onDone: () => void
  onBack: () => void
}

export function RecordPaymentScreen({ loanId, initialType = 'regular', onDone, onBack }: Props) {
  useBackButton(onBack)

  const [loan, setLoan] = useState<Loan | null>(null)
  const [type, setType] = useState<PaymentType>(initialType)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load loan info for hint amounts
  useState(() => {
    loansApi.list().then(loans => {
      const l = loans.find(l => l.id === loanId)
      if (l) {
        setLoan(l)
        setAmount(String(l.next_payment_amount ?? l.monthly_payment))
      }
    })
  })

  const checkWarningsAndSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Введіть суму > 0'); return
    }
    setError(null)

    if (type === 'regular' && loan) {
      const entered = new Decimal(amount.replace(/\s/g, ''))
      const min = new Decimal(String(loan.monthly_payment))
      const recommended = loan.next_payment_amount
        ? new Decimal(String(loan.next_payment_amount))
        : null

      // FR-FORECAST-2: underpayment warning
      if (entered.lt(min)) {
        const confirmed = await new Promise<boolean>(r =>
          WebApp.showConfirm(
            `Сума менша за мінімальний платіж (${formatAmount(loan.monthly_payment)}). Термін погашення збільшиться. Все одно зберегти?`,
            r,
          )
        )
        if (!confirmed) return
      }
      // FR-FORECAST-2: motivational (entered >= min but < recommended)
      else if (recommended && entered.lt(recommended) && recommended.gt(min)) {
        const confirmed = await new Promise<boolean>(r =>
          WebApp.showConfirm(
            `Якщо внести рекомендовану суму (${formatAmount(recommended.toString())}), закриєте кредит раніше. Все одно зберегти ${formatAmount(entered.toString())}?`,
            r,
          )
        )
        if (!confirmed) return
      }
    }

    await handleSave()
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await paymentsApi.record(loanId, {
        actual_date: date,
        actual_amount: new Decimal(amount.replace(/\s/g, '')).toFixed(2),
        is_extra: type === 'extra',
        ...(type === 'regular' && loan?.next_payment_date
          ? {
              planned_date: loan.next_payment_date,
              planned_amount: String(loan.next_payment_amount ?? loan.monthly_payment),
            }
          : {}),
      })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-text-primary">Внести платіж</h1>
        {loan && (
          <p className="text-text-secondary text-sm">{loan.name}</p>
        )}
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Type toggle */}
        <div className="flex bg-white rounded-button p-1 shadow-card-sm">
          <TypeBtn active={type === 'regular'} onClick={() => {
            setType('regular')
            if (loan) setAmount(String(loan.next_payment_amount ?? loan.monthly_payment))
          }}>
            Плановий
          </TypeBtn>
          <TypeBtn active={type === 'extra'} onClick={() => {
            setType('extra'); setAmount('')
          }}>
            Додатковий
          </TypeBtn>
        </div>

        {/* Amount hints */}
        {loan && type === 'regular' && (
          <div className="flex gap-2">
            {loan.next_payment_amount &&
              String(loan.next_payment_amount) !== String(loan.monthly_payment) && (
              <HintButton
                label={`Рекомендований: ${formatAmount(loan.next_payment_amount)}`}
                onClick={() => setAmount(String(loan.next_payment_amount))}
              />
            )}
            <HintButton
              label={`Мінімальний: ${formatAmount(loan.monthly_payment)}`}
              onClick={() => setAmount(String(loan.monthly_payment))}
            />
          </div>
        )}

        {/* Amount input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
            Сума, ₴
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary text-lg bg-white outline-none focus:border-sage"
            placeholder="0,00"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/\s/g, ''))}
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
            Дата
          </label>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {error && <p className="text-terracotta text-sm px-1">{error}</p>}

        <button
          onClick={checkWarningsAndSave}
          disabled={loading}
          className="w-full bg-sage text-white font-bold py-4 rounded-button
                     active:bg-sage-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Збереження…' : 'Підтвердити'}
        </button>
      </div>
    </div>
  )
}

function TypeBtn({ active, onClick, children }: {
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

function HintButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs bg-sage-light text-sage font-semibold px-3 py-2 rounded-xl active:bg-sage active:text-white transition-colors"
    >
      {label}
    </button>
  )
}
