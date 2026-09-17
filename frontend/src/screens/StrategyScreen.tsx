/**
 * Strategy screen — 4 states (SRS FR-STRAT-11):
 *  onboarding → budget → loading → result
 */
import { useEffect, useState, useCallback } from 'react'
import Decimal from 'decimal.js'
import { loansApi } from '../api/loans'
import { planApi, PlanOut } from '../api/plan'
import { settingsApi } from '../api/settings'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { formatAmount, formatDate, monthsPhrase } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { Loan, UserSettings } from '../api/types'

type Stage = 'loading-init' | 'onboarding' | 'budget' | 'calculating' | 'result'
type Strategy = 'avalanche' | 'snowball'

interface Props {
  onDone: () => void
  onBack: () => void
  onAddLoan: () => void
}

export function StrategyScreen({ onDone, onBack, onAddLoan }: Props) {
  useBackButton(onBack)

  const [stage, setStage] = useState<Stage>('loading-init')
  const [loans, setLoans] = useState<Loan[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [plan, setPlan] = useState<PlanOut | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('avalanche')
  const [budgetText, setBudgetText] = useState('')
  const [saving, setSaving] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)

  const budget = budgetText.trim()
    ? new Decimal(budgetText.replace(/[\s ]/g, '').replace(',', '.'))
    : null
  const mandatoryTotal = loans.reduce(
    (s, l) => s.plus(String(l.monthly_payment)),
    new Decimal('0'),
  )
  const freeBalance = budget ? budget.minus(mandatoryTotal) : null

  // Load plan for given strategy and budget (preview — does not save)
  const fetchPlan = useCallback(async (strat: Strategy, bgt?: string) => {
    setPlanLoading(true)
    try {
      const p = await planApi.get({
        strategy: strat,
        monthly_budget: bgt || undefined,
      })
      setPlan(p)
    } finally {
      setPlanLoading(false)
    }
  }, [])

  // Initial load: settings + loans
  useEffect(() => {
    Promise.all([loansApi.list(), settingsApi.get()]).then(([l, s]) => {
      setLoans(l)
      setSettings(s)
      const strat: Strategy = s.strategy === 'snowball' ? 'snowball' : 'avalanche'
      setSelectedStrategy(strat)
      if (s.monthly_budget) setBudgetText(String(s.monthly_budget))

      if (s.strategy !== 'none') {
        fetchPlan(strat, s.monthly_budget ? String(s.monthly_budget) : undefined)
        setStage('result')
      } else {
        setStage('onboarding')
      }
    })
  }, [fetchPlan])

  const handleStrategySelect = async (strat: Strategy) => {
    setSelectedStrategy(strat)
    await fetchPlan(strat, budget?.toFixed(2))
  }

  const handleCalculate = () => {
    setStage('calculating')
    const delay = 1500 + Math.random() * 1000
    setTimeout(async () => {
      await fetchPlan(selectedStrategy, budget?.toFixed(2))
      setStage('result')
    }, delay)
  }

  const handleSave = async () => {
    setSaving(true)
    await settingsApi.update({
      strategy: selectedStrategy,
      monthly_budget: budget ? budget.toFixed(2) : undefined,
    })
    setSaving(false)
    onDone()
  }

  // ─── Stage: initial loading ──────────────────────────────────────────────
  if (stage === 'loading-init') return <LoadingSpinner className="h-screen" />

  // ─── Stage: onboarding ───────────────────────────────────────────────────
  if (stage === 'onboarding') {
    return (
      <div className="min-h-screen bg-cream safe-top safe-bottom flex flex-col items-center justify-center px-6 gap-8">
        <div className="w-24 h-24 bg-white rounded-full shadow-card flex items-center justify-center text-4xl">
          🎯
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Оберіть стратегію
          </h1>
          <p className="text-text-secondary text-sm">
            Оберіть стратегію, з якою швидше звільнишся від боргів
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          {loans.length > 0 && (
            <button
              onClick={() => setStage('budget')}
              className="w-full bg-sage text-white font-bold py-4 rounded-button active:bg-sage-dark"
            >
              Обрати план
            </button>
          )}
          <button
            onClick={onAddLoan}
            className="w-full bg-white border border-sage/30 text-sage font-semibold py-4 rounded-button"
          >
            Додати кредит
          </button>
        </div>
      </div>
    )
  }

  // ─── Stage: budget ───────────────────────────────────────────────────────
  if (stage === 'budget') {
    return (
      <div className="min-h-screen bg-cream safe-top safe-bottom">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold text-text-primary">Ваш бюджет</h1>
          <p className="text-text-secondary text-sm mt-1">
            Скільки ви готові виділяти на місяць на кредити?
          </p>
        </div>

        <div className="px-4 flex flex-col gap-4 pt-4">
          {/* Budget input */}
          <div className="bg-white rounded-card shadow-card p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Сума на місяць
            </p>
            <div className="flex items-baseline gap-2">
              <input
                className="flex-1 text-3xl font-bold text-text-primary outline-none bg-transparent"
                placeholder="0"
                inputMode="decimal"
                value={budgetText}
                onChange={e => setBudgetText(e.target.value)}
              />
              <span className="text-xl text-text-secondary">₴</span>
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm">
              <div>
                <p className="text-text-secondary text-xs">Обов'язкові</p>
                <p className="font-semibold">{formatAmount(mandatoryTotal)}</p>
              </div>
              {freeBalance && (
                <div className="text-right">
                  <p className="text-text-secondary text-xs">Вільно</p>
                  <p className={`font-semibold ${freeBalance.gt(0) ? 'text-sage' : 'text-terracotta'}`}>
                    {freeBalance.gt(0) ? formatAmount(freeBalance) : '—'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full bg-sage text-white font-bold py-4 rounded-button active:bg-sage-dark"
          >
            Підрахувати план
          </button>
        </div>
      </div>
    )
  }

  // ─── Stage: calculating ──────────────────────────────────────────────────
  if (stage === 'calculating') {
    return (
      <div className="min-h-screen bg-cream safe-top safe-bottom flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 bg-white rounded-full shadow-card flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-sage-light border-t-sage rounded-full animate-spin" />
        </div>
        <p className="text-text-secondary font-semibold">
          Підбираємо оптимальну стратегію…
        </p>
      </div>
    )
  }

  // ─── Stage: result ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-text-primary">План погашення</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {/* Strategy cards */}
        <div className="flex flex-col gap-3">
          <StrategyCard
            title="Лавина"
            description="Спершу кредит з найбільшою ставкою"
            isRecommended
            selected={selectedStrategy === 'avalanche'}
            onClick={() => handleStrategySelect('avalanche')}
          />
          <StrategyCard
            title="Сніжний ком"
            description="Спершу найменший борг — швидкі перемоги"
            selected={selectedStrategy === 'snowball'}
            onClick={() => handleStrategySelect('snowball')}
          />
        </div>

        {planLoading && <LoadingSpinner className="py-4" />}

        {plan && !planLoading && (
          <>
            {/* Budget shortfall warning */}
            {plan.budget_shortfall !== null && (
              <div className="bg-terracotta/10 border border-terracotta/30 rounded-card px-4 py-3 text-sm text-terracotta">
                ⚠️ Бюджет менший за обов'язкові платежі. Бракує{' '}
                {formatAmount(plan.budget_shortfall)}.
              </div>
            )}

            {/* Effect banner */}
            {plan.saved_months > 0 && (
              <div className="bg-sage rounded-card px-4 py-4 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-white font-bold text-sm">
                    З цією стратегією — на {monthsPhrase(plan.saved_months)} раніше
                  </p>
                  {plan.closing_date_all && (
                    <p className="text-white/80 text-xs mt-0.5">
                      Закриєте все до {formatDate(plan.closing_date_all)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Monthly plan */}
            {plan.recommendations.length > 0 && plan.budget_shortfall === null && (
              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2 px-1">
                  Цього місяця
                </p>
                <div className="bg-white rounded-card shadow-card-sm overflow-hidden">
                  {plan.recommendations.map((rec, i) => (
                    <div key={rec.loan_id}>
                      <div className="flex justify-between items-center px-4 py-3">
                        <p className="font-semibold text-text-primary text-sm truncate flex-1">
                          {rec.loan_name}
                        </p>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="font-bold text-text-primary text-sm">
                            {formatAmount(rec.total_amount)}
                          </p>
                          {Number(rec.extra_amount) > 0 && (
                            <p className="text-sage text-xs">
                              +{formatAmount(rec.extra_amount)} додатково
                            </p>
                          )}
                        </div>
                      </div>
                      {i < plan.recommendations.length - 1 && (
                        <div className="border-b border-gray-100 mx-4" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => setStage('budget')}
            className="w-full bg-white border border-gray-200 text-text-primary font-semibold py-3 rounded-button"
          >
            Змінити бюджет
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-sage text-white font-bold py-4 rounded-button active:bg-sage-dark disabled:opacity-50"
          >
            {saving ? 'Збереження…' : 'Обрати стратегію'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Strategy card sub-component ────────────────────────────────────────────

interface CardProps {
  title: string
  description: string
  selected: boolean
  isRecommended?: boolean
  onClick: () => void
}

function StrategyCard({ title, description, selected, isRecommended, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-card p-4 transition-all
        ${selected
          ? 'bg-sage/10 border-2 border-sage shadow-card-sm'
          : 'bg-white shadow-card border-2 border-transparent'}`}
    >
      <div className="flex items-start gap-3">
        {/* Radio dot */}
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
          ${selected ? 'border-sage' : 'border-gray-300'}`}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-sage" />}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary">{title}</span>
            {isRecommended && (
              <span className="text-xs font-bold text-white bg-sage px-2 py-0.5 rounded-full">
                Рекомендовано
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  )
}
