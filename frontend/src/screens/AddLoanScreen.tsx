import { useState, useEffect } from 'react'
import Decimal from 'decimal.js'
import { loansApi } from '../api/loans'
import { annuityPayment, isPaymentSufficient, isZeroRatePlan } from '../utils/calculator'
import { formatAmount, todayISO } from '../utils/format'
import { SegmentControl } from '../components/SegmentControl'
import { InputField } from '../components/InputField'
import { useBackButton } from '../hooks/useTelegram'
import type { LoanDetail } from '../api/types'

interface Props {
  editLoanId?: string
  onDone: (loan: LoanDetail) => void
  onBack: () => void
}

type Scenario = 'new' | 'existing'
type InputMode = 'rate' | 'payment'

export function AddLoanScreen({ editLoanId, onDone, onBack }: Props) {
  useBackButton(onBack)

  const isEdit = !!editLoanId

  const [scenario, setScenario] = useState<Scenario>('new')
  const [inputMode, setInputMode] = useState<InputMode>('rate')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentsCount, setPaymentsCount] = useState('')
  const [annualRate, setAnnualRate] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [firstDate, setFirstDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editLoanId) return
    loansApi.get(editLoanId).then(loan => {
      setName(loan.name)
      setAmount(String(loan.initial_amount))
      setPaymentsCount(String(loan.total_planned_payments))
      setAnnualRate(String(loan.annual_rate))
      setMonthlyPayment(String(loan.monthly_payment))
      setFirstDate(loan.first_payment_date)
      setInputMode('rate')
    })
  }, [editLoanId])

  const preview = (() => {
    try {
      const s = new Decimal(amount || '0')
      const n = parseInt(paymentsCount) || 0
      if (s.lte(0) || n <= 0) return null
      if (inputMode === 'rate') {
        const r = new Decimal(annualRate || '0')
        if (r.lt(0)) return null
        return { monthly: annuityPayment(s, r, n), rate: null, error: null }
      } else {
        const mp = new Decimal(monthlyPayment || '0')
        if (!isPaymentSufficient(s, n, mp)) return { monthly: null, rate: null, error: 'Платіж × кількість < суми кредиту' }
        if (isZeroRatePlan(s, n, mp)) return { monthly: mp, rate: new Decimal('0'), error: null }
        return { monthly: mp, rate: null, error: null }
      }
    } catch { return null }
  })()

  const isValid = !error && !preview?.error && preview?.monthly

  const validate = (): string | null => {
    if (!name.trim()) return 'Введіть назву'
    const s = parseFloat(amount)
    const n = parseInt(paymentsCount)
    if (!s || s <= 0) return 'Введіть суму > 0'
    if (!n || n <= 0) return 'Введіть кількість платежів > 0'
    if (inputMode === 'rate') {
      const r = parseFloat(annualRate)
      if (isNaN(r) || r < 0) return 'Введіть ставку ≥ 0'
    } else {
      const mp = parseFloat(monthlyPayment)
      if (!mp || mp <= 0) return 'Введіть суму платежу > 0'
      if (preview?.error) return preview.error
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        is_already_paying: scenario === 'existing',
        initial_amount: amount,
        total_planned_payments: parseInt(paymentsCount),
        input_mode: inputMode,
        ...(inputMode === 'rate' ? { annual_rate: annualRate } : { monthly_payment: monthlyPayment }),
        first_payment_date: firstDate,
      }
      const loan = isEdit ? await loansApi.update(editLoanId!, payload) : await loansApi.create(payload)
      onDone(loan)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen safe-top pb-8" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4">
        <button onClick={onBack} className="icon-btn w-[38px] h-[38px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isEdit ? 'Редагувати кредит' : 'Новий кредит'}
        </span>
        <button
          onClick={handleSave}
          disabled={loading}
          className="text-[15px] font-bold rounded-pill px-[18px] py-2.5 transition-all"
          style={isValid
            ? { background: '#2A2A2E', color: 'white', boxShadow: '5px 5px 8px rgba(199,195,186,0.7), -4px -4px 6px rgba(253,251,246,1.0)' }
            : { background: 'var(--bg)', color: 'var(--text-secondary)', boxShadow: '5px 5px 8px rgba(199,195,186,0.7), -4px -4px 6px rgba(253,251,246,1.0)' }
          }
        >
          {loading ? '…' : 'Зберегти'}
        </button>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Scenario segment */}
        {!isEdit && (
          <SegmentControl
            tabs={[{ value: 'new', label: 'Новий' }, { value: 'existing', label: 'Вже плачу' }]}
            value={scenario}
            onChange={v => setScenario(v as Scenario)}
          />
        )}

        {/* Name */}
        <InputField
          label="Назва кредиту"
          placeholder="Авто, Іпотека, Розстрочка…"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Amount */}
        <InputField
          label={scenario === 'existing' ? 'Поточний залишок, ₴' : 'Сума кредиту, ₴'}
          placeholder="100 000"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/\s/g, ''))}
        />

        {/* Input mode segment */}
        <div>
          <p className="input-label mb-2">Що ви знаєте?</p>
          <SegmentControl
            tabs={[{ value: 'rate', label: 'Ставку' }, { value: 'payment', label: 'Суму платежу' }]}
            value={inputMode}
            onChange={v => setInputMode(v as InputMode)}
          />
        </div>

        {inputMode === 'rate' ? (
          <InputField
            label="Річна ставка, %"
            placeholder="24"
            inputMode="decimal"
            value={annualRate}
            onChange={e => setAnnualRate(e.target.value)}
          />
        ) : (
          <InputField
            label="Щомісячний платіж, ₴"
            placeholder="5 287"
            inputMode="decimal"
            value={monthlyPayment}
            onChange={e => setMonthlyPayment(e.target.value.replace(/\s/g, ''))}
          />
        )}

        {/* Payments count */}
        <InputField
          label={scenario === 'existing' ? 'Платежів залишилось' : 'Кількість платежів'}
          placeholder="36"
          inputMode="numeric"
          value={paymentsCount}
          onChange={e => setPaymentsCount(e.target.value)}
        />

        {/* Date */}
        <InputField
          label={scenario === 'existing' ? 'Наступний платіж' : 'Перший платіж'}
          type="date"
          value={firstDate}
          onChange={e => setFirstDate(e.target.value)}
        />

        {/* Error block */}
        {(error || preview?.error) && (
          <div className="flex items-center gap-2 rounded-small px-4 py-3" style={{ background: 'rgba(196,100,74,0.08)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--terracotta)">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>
            </svg>
            <span className="text-[13px]" style={{ color: 'var(--terracotta)' }}>{error || preview?.error}</span>
          </div>
        )}

      </div>

      {/* ── Bottom preview panel (appears when valid data) ── */}
      {preview && !preview.error && preview.monthly && (
        <div
          className="fixed bottom-0 left-0 right-0 px-5 pt-5 pb-8"
          style={{
            background: 'var(--accent)',
            borderRadius: '24px 24px 0 0',
            boxShadow: '5px 7px 10px rgba(216,90,48,0.45), -3px -3px 6px rgba(253,251,246,1.0)',
            animation: 'slideUpFade 200ms ease-in-out',
          }}
        >
          <p className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Щомісячний платіж
          </p>
          <p className="text-[28px] font-bold" style={{ color: 'white' }}>
            {formatAmount(preview.monthly.toString())}
          </p>
          <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {inputMode === 'payment' && preview.rate?.isZero()
              ? 'Розстрочка (ставка 0%)'
              : 'Останній платіж може відрізнятись'}
          </p>
        </div>
      )}
    </div>
  )
}
