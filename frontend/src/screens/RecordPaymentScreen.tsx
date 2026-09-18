import { useState } from 'react'
import Decimal from 'decimal.js'
import WebApp from '@twa-dev/sdk'
import { paymentsApi } from '../api/payments'
import { loansApi } from '../api/loans'
import { formatAmount, todayISO } from '../utils/format'
import { SegmentControl } from '../components/SegmentControl'
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
        if (initialType === 'regular') setAmount(String(l.next_payment_amount ?? l.monthly_payment))
      }
    })
  })

  const checkWarningsAndSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Введіть суму > 0'); return }
    setError(null)

    if (type === 'regular' && loan) {
      const entered = new Decimal(amount.replace(/[\s,]/g, '.'))
      const min = new Decimal(String(loan.monthly_payment))
      const recommended = loan.next_payment_amount ? new Decimal(String(loan.next_payment_amount)) : null

      if (entered.lt(min)) {
        const ok = await new Promise<boolean>(r => WebApp.showConfirm(
          `Сума менша за мінімальний платіж (${formatAmount(loan.monthly_payment)}). Термін погашення збільшиться. Все одно зберегти?`, r))
        if (!ok) return
      } else if (recommended && entered.lt(recommended) && recommended.gt(min)) {
        const ok = await new Promise<boolean>(r => WebApp.showConfirm(
          `Якщо внести рекомендовану суму (${formatAmount(recommended.toString())}), закриєте кредит раніше. Все одно зберегти ${formatAmount(entered.toString())}?`, r))
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
        ...(type === 'regular' && loan?.next_payment_date ? {
          planned_date: loan.next_payment_date,
          planned_amount: String(loan.next_payment_amount ?? loan.monthly_payment),
        } : {}),
      })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen safe-top pb-8 flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4">
        <button
          onClick={onBack}
          className="text-[15px] font-medium active:opacity-60"
          style={{ color: 'var(--text-secondary)' }}
        >
          Скасувати
        </button>
        <div className="text-center">
          <p className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>Внести платіж</p>
          {loan && <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{loan.name}</p>}
        </div>
        <button
          onClick={checkWarningsAndSave}
          disabled={loading || !amount}
          className="text-[16px] font-semibold"
          style={{ color: amount ? 'var(--sage)' : 'var(--text-secondary)' }}
        >
          {loading ? '…' : 'Внести'}
        </button>
      </div>

      {/* ── Type segment ── */}
      <div className="px-5 mb-2">
        <SegmentControl
          tabs={[{ value: 'regular', label: 'Плановий' }, { value: 'extra', label: 'Додатковий' }]}
          value={type}
          onChange={v => {
            setType(v as PaymentType)
            if (v === 'regular' && loan) setAmount(String(loan.next_payment_amount ?? loan.monthly_payment))
            else setAmount('')
          }}
        />
      </div>

      {/* ── Large amount input (iOS-style) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
        <p className="input-label mb-4">Сума платежу</p>
        <div className="relative w-full max-w-xs">
          <input
            className="w-full text-center text-[38px] font-bold bg-transparent outline-none pb-2"
            style={{
              color: 'var(--text-primary)',
              borderBottom: '2px solid var(--accent)',
            }}
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span
            className="absolute right-0 bottom-3 text-[20px] font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >₴</span>
        </div>

        {/* Hint buttons */}
        {loan && type === 'regular' && (
          <div className="flex gap-2 mt-6 flex-wrap justify-center">
            {loan.next_payment_amount && String(loan.next_payment_amount) !== String(loan.monthly_payment) && (
              <button
                onClick={() => setAmount(String(loan.next_payment_amount!))}
                className="text-[13px] font-semibold rounded-pill px-4 py-2 active:opacity-60"
                style={{ color: 'var(--sage)', background: 'rgba(92,138,107,0.1)' }}
              >
                Рекомендований {formatAmount(loan.next_payment_amount)}
              </button>
            )}
            <button
              onClick={() => setAmount(String(loan.monthly_payment))}
              className="text-[13px] font-semibold rounded-pill px-4 py-2 active:opacity-60"
              style={{ color: 'var(--text-secondary)', background: 'rgba(138,138,142,0.1)' }}
            >
              Мінімальний {formatAmount(loan.monthly_payment)}
            </button>
          </div>
        )}
      </div>

      {/* ── Date + save ── */}
      <div className="px-5 flex flex-col gap-3">
        <div className="neu-raised rounded-card px-5 py-3.5 flex items-center justify-between">
          <span className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Дата</span>
          <input
            type="date"
            className="text-[14px] font-medium bg-transparent outline-none"
            style={{ color: 'var(--text-primary)' }}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {error && <p className="text-center text-[13px]" style={{ color: 'var(--terracotta)' }}>{error}</p>}

        <button
          onClick={checkWarningsAndSave}
          disabled={loading || !amount}
          className="btn-primary disabled:opacity-40"
        >
          {loading ? 'Збереження…' : 'Підтвердити'}
        </button>
      </div>
    </div>
  )
}
