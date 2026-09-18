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

  useState(() => {
    loansApi.list().then(loans => {
      const l = loans.find(l => l.id === loanId)
      if (l) {
        setLoan(l)
        if (initialType === 'regular') {
          setAmount(String(l.next_payment_amount ?? l.monthly_payment))
        }
      }
    })
  })

  const checkWarningsAndSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Введіть суму > 0'); return
    }
    setError(null)

    if (type === 'regular' && loan) {
      const entered = new Decimal(amount.replace(/[\s,]/g, '.'))
      const min = new Decimal(String(loan.monthly_payment))
      const recommended = loan.next_payment_amount
        ? new Decimal(String(loan.next_payment_amount))
        : null

      if (entered.lt(min)) {
        const ok = await new Promise<boolean>(r =>
          WebApp.showConfirm(
            `Сума менша за мінімальний платіж (${formatAmount(loan.monthly_payment)}). Термін погашення збільшиться. Все одно зберегти?`,
            r,
          )
        )
        if (!ok) return
      } else if (recommended && entered.lt(recommended) && recommended.gt(min)) {
        const ok = await new Promise<boolean>(r =>
          WebApp.showConfirm(
            `Якщо внести рекомендовану суму (${formatAmount(recommended.toString())}), закриєте кредит раніше. Все одно зберегти ${formatAmount(entered.toString())}?`,
            r,
          )
        )
        if (!ok) return
      }
    }

    await handleSave()
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const cleanAmount = new Decimal(amount.replace(/[\s]/g, '')).toFixed(2)
      await paymentsApi.record(loanId, {
        actual_date: date,
        actual_amount: cleanAmount,
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

  const setHint = (val: string | number) => setAmount(String(val))

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-card-sm px-4 pt-4 pb-4">
        <h1 className="text-xl font-bold text-text-primary">Внести платіж</h1>
        {loan && <p className="text-sm text-text-secondary mt-0.5">{loan.name}</p>}
      </div>

      {/* Type toggle */}
      <div className="px-4 pt-4">
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
      </div>

      {/* Large amount input */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <p className="text-xs font-bold text-text-secondary tracking-widest mb-3">СУМА ПЛАТЕЖУ</p>
        <div className="relative w-full">
          <input
            className="w-full text-center text-4xl font-bold text-text-primary bg-transparent
                       border-b-2 border-sage outline-none pb-2 placeholder:text-gray-300"
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span className="absolute right-0 bottom-2 text-xl text-text-secondary font-medium">₴</span>
        </div>

        {/* Hint buttons */}
        {loan && type === 'regular' && (
          <div className="flex gap-2 mt-5 flex-wrap justify-center">
            {loan.next_payment_amount &&
              String(loan.next_payment_amount) !== String(loan.monthly_payment) && (
              <HintButton
                label={`Рекомендований ${formatAmount(loan.next_payment_amount)}`}
                onClick={() => setHint(loan.next_payment_amount!)}
              />
            )}
            <HintButton
              label={`Мінімальний ${formatAmount(loan.monthly_payment)}`}
              onClick={() => setHint(loan.monthly_payment)}
            />
          </div>
        )}
      </div>

      {/* Date + save */}
      <div className="px-4 flex flex-col gap-3">
        <div className="flex items-center justify-between bg-white rounded-card shadow-card-sm px-4 py-3">
          <span className="text-sm text-text-secondary">Дата</span>
          <input
            type="date"
            className="text-sm font-medium text-text-primary bg-transparent outline-none"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {error && <p className="text-terracotta text-sm text-center">{error}</p>}

        <button
          onClick={checkWarningsAndSave}
          disabled={loading || !amount}
          className="w-full bg-sage text-white font-bold py-4 rounded-button text-base
                     active:bg-sage-dark transition-colors disabled:opacity-40 shadow-sm"
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
      className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
        ${active ? 'bg-sage text-white shadow-sm' : 'text-text-secondary'}`}
    >
      {children}
    </button>
  )
}

function HintButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm bg-sage-light text-sage font-semibold px-4 py-2 rounded-xl active:bg-sage active:text-white transition-colors"
    >
      {label}
    </button>
  )
}
