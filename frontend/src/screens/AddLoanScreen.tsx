import { useState, useEffect } from 'react'
import Decimal from 'decimal.js'
import { loansApi } from '../api/loans'
import { annuityPayment, isPaymentSufficient, isZeroRatePlan } from '../utils/calculator'
import { formatAmount, todayISO } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { LoanDetail } from '../api/types'

interface Props {
  editLoanId?: string          // undefined → create mode
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

  // Load loan data in edit mode
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

  // Live preview
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
        if (!isPaymentSufficient(s, n, mp)) {
          return { monthly: null, rate: null, error: 'Платіж × кількість < суми кредиту' }
        }
        if (isZeroRatePlan(s, n, mp)) {
          return { monthly: mp, rate: new Decimal('0'), error: null }
        }
        return { monthly: mp, rate: null, error: null }
      }
    } catch {
      return null
    }
  })()

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
      const loan = isEdit
        ? await loansApi.update(editLoanId!, payload)
        : await loansApi.create(payload)
      onDone(loan)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-text-primary">
          {isEdit ? 'Редагувати кредит' : 'Новий кредит'}
        </h1>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Scenario tabs */}
        {!isEdit && (
          <div className="flex bg-white rounded-button p-1 shadow-card-sm">
            {(['new', 'existing'] as Scenario[]).map(s => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors
                  ${scenario === s ? 'bg-sage text-white' : 'text-text-secondary'}`}
              >
                {s === 'new' ? 'Новий' : 'Вже плачу'}
              </button>
            ))}
          </div>
        )}

        {/* Name */}
        <Field label="Назва">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
            placeholder="Авто, Іпотека, Розстрочка…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        {/* Amount */}
        <Field label={scenario === 'existing' ? 'Поточний залишок, ₴' : 'Сума кредиту, ₴'}>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
            placeholder="100 000"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/\s/g, ''))}
          />
        </Field>

        {/* Payments count */}
        <Field label={scenario === 'existing' ? 'Платежів залишилось' : 'Кількість платежів'}>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
            placeholder="24"
            inputMode="numeric"
            value={paymentsCount}
            onChange={e => setPaymentsCount(e.target.value)}
          />
        </Field>

        {/* Input mode */}
        <div className="flex bg-white rounded-button p-1 shadow-card-sm">
          {(['rate', 'payment'] as InputMode[]).map(m => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors
                ${inputMode === m ? 'bg-sage text-white' : 'text-text-secondary'}`}
            >
              {m === 'rate' ? 'Я знаю ставку' : 'Я знаю платіж'}
            </button>
          ))}
        </div>

        {inputMode === 'rate' ? (
          <Field label="Річна ставка, %">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
              placeholder="24"
              inputMode="decimal"
              value={annualRate}
              onChange={e => setAnnualRate(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Щомісячний платіж, ₴">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
              placeholder="5 287"
              inputMode="decimal"
              value={monthlyPayment}
              onChange={e => setMonthlyPayment(e.target.value.replace(/\s/g, ''))}
            />
          </Field>
        )}

        {/* Date */}
        <Field label={scenario === 'existing' ? 'Наступний платіж' : 'Перший платіж'}>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-text-primary bg-white outline-none focus:border-sage"
            value={firstDate}
            onChange={e => setFirstDate(e.target.value)}
          />
        </Field>

        {/* Preview */}
        {preview && !preview.error && preview.monthly && (
          <div className="bg-sage-light rounded-xl px-4 py-3 text-sm text-sage-dark">
            {inputMode === 'rate' ? (
              <>Щомісячний платіж: <strong>{formatAmount(preview.monthly)}</strong></>
            ) : (
              preview.rate?.isZero()
                ? <>Ставка: <strong>0% (розстрочка)</strong></>
                : <>Ставка підбирається сервером</>
            )}
          </div>
        )}

        {/* Error */}
        {(error || preview?.error) && (
          <p className="text-terracotta text-sm px-1">{error || preview?.error}</p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-sage text-white font-bold py-4 rounded-button
                     active:bg-sage-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Збереження…' : (isEdit ? 'Зберегти' : 'Додати кредит')}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide px-1">
        {label}
      </label>
      {children}
    </div>
  )
}
