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
  const [, setSettings] = useState<UserSettings | null>(null)
  const [plan, setPlan] = useState<PlanOut | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('avalanche')
  const [budgetText, setBudgetText] = useState('')
  const [saving, setSaving] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)

  const budget = budgetText.trim()
    ? new Decimal(budgetText.replace(/[\s ]/g, '').replace(',', '.'))
    : null
  const mandatoryTotal = loans.reduce((s, l) => s.plus(String(l.monthly_payment)), new Decimal('0'))
  const freeBalance = budget ? budget.minus(mandatoryTotal) : null

  const fetchPlan = useCallback(async (strat: Strategy, bgt?: string) => {
    setPlanLoading(true)
    try {
      const p = await planApi.get({ strategy: strat, monthly_budget: bgt || undefined })
      setPlan(p)
    } finally {
      setPlanLoading(false)
    }
  }, [])

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
    setTimeout(async () => {
      await fetchPlan(selectedStrategy, budget?.toFixed(2))
      setStage('result')
    }, 1500 + Math.random() * 1000)
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

  if (stage === 'loading-init') return <LoadingSpinner className="h-screen" />

  // ── Onboarding ──
  if (stage === 'onboarding') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-8" style={{ background: 'var(--bg)', paddingTop: 'max(60px, env(safe-area-inset-top, 0px) + 16px)' }}>
        <div
          className="w-[140px] h-[140px] rounded-icon flex items-center justify-center"
          style={{ boxShadow: '8px 8px 14px rgba(199,195,186,0.75), -8px -8px 14px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        </div>

        <div className="text-center">
          <h1 className="font-serif font-semibold text-[26px] mb-3" style={{ color: 'var(--text-primary)' }}>
            Оберіть стратегію
          </h1>
          <p className="text-[15px] max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
            Оберіть стратегію, з якою швидше звільнишся від боргів
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          {loans.length > 0 && (
            <button
              onClick={() => setStage('budget')}
              className="btn-accent"
            >
              Обрати план
            </button>
          )}
          <button onClick={onAddLoan} className="btn-secondary">
            Додати кредит
          </button>
        </div>
      </div>
    )
  }

  // ── Budget ──
  if (stage === 'budget') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'max(60px, env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center px-5 pb-4 gap-3">
          <button onClick={() => setStage('onboarding')} className="icon-btn w-[38px] h-[38px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
            Ваш бюджет
          </h1>
        </div>

        <div className="px-5 flex flex-col gap-4">
          <div className="neu-raised rounded-card p-5">
            <p className="input-label mb-2">Сума на місяць</p>
            <div className="flex items-baseline gap-2">
              <input
                className="flex-1 text-[38px] font-bold bg-transparent outline-none"
                style={{ color: 'var(--text-primary)', borderBottom: '2px solid var(--accent)' }}
                placeholder="0"
                inputMode="decimal"
                value={budgetText}
                onChange={e => setBudgetText(e.target.value)}
              />
              <span className="text-[20px]" style={{ color: 'var(--text-secondary)' }}>₴</span>
            </div>
            <div style={{ height: 1, background: 'var(--divider)', margin: '16px 0 12px' }} />
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-[12px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Обов'язкові</p>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatAmount(mandatoryTotal.toString())}
                </p>
              </div>
              {freeBalance && (
                <div className="text-right">
                  <p className="text-[12px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Вільно</p>
                  <p className="text-[14px] font-semibold" style={{ color: freeBalance.gt(0) ? 'var(--sage)' : 'var(--terracotta)' }}>
                    {freeBalance.gt(0) ? formatAmount(freeBalance.toString()) : '—'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button onClick={handleCalculate} className="btn-accent">
            Підрахувати план
          </button>
        </div>
      </div>
    )
  }

  // ── Calculating ──
  if (stage === 'calculating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: 'var(--bg)' }}>
        <div
          className="w-[100px] h-[100px] rounded-icon flex items-center justify-center"
          style={{ boxShadow: '8px 8px 14px rgba(199,195,186,0.75), -8px -8px 14px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
        >
          <div
            className="w-10 h-10 rounded-full border-4 animate-spin"
            style={{ borderColor: 'var(--segment-bg)', borderTopColor: 'var(--accent)' }}
          />
        </div>
        <p className="text-[15px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Підбираємо оптимальну стратегію…
        </p>
      </div>
    )
  }

  // ── Result ──
  return (
    <div className="min-h-screen pb-6" style={{ background: 'var(--bg)', paddingTop: 'max(60px, env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="px-5 pb-2">
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          План
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-4">

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
            {plan.budget_shortfall !== null && (
              <div className="flex items-center gap-2 rounded-card px-4 py-3" style={{ background: 'rgba(196,100,74,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--terracotta)">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/>
                </svg>
                <span className="text-[13px]" style={{ color: 'var(--terracotta)' }}>
                  Бюджет менший за обов'язкові платежі. Бракує {formatAmount(plan.budget_shortfall)}.
                </span>
              </div>
            )}

            {plan.saved_months > 0 && (
              <div
                className="rounded-card px-4 py-4 flex items-center gap-3"
                style={{ background: 'var(--clay)', boxShadow: '5px 5px 8px rgba(199,195,186,0.7), -4px -4px 6px rgba(253,251,246,1.0)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                <div>
                  <p className="font-bold text-[14px] text-white">
                    На {monthsPhrase(plan.saved_months)} раніше з цією стратегією
                  </p>
                  {plan.closing_date_all && (
                    <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Закриєте все до {formatDate(plan.closing_date_all)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {plan.recommendations.length > 0 && plan.budget_shortfall === null && (
              <div>
                <p className="section-header">Цього місяця</p>
                <div className="neu-raised rounded-card overflow-hidden">
                  {plan.recommendations.map((rec, i) => (
                    <div key={rec.loan_id}>
                      <div className="flex justify-between items-center px-5 py-3.5">
                        <p className="font-semibold text-[14px] truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                          {rec.loan_name}
                        </p>
                        <div className="text-right ml-2 flex-shrink-0">
                          <p className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>
                            {formatAmount(rec.total_amount)}
                          </p>
                          {Number(rec.extra_amount) > 0 && (
                            <p className="text-[12px]" style={{ color: 'var(--sage)' }}>
                              +{formatAmount(rec.extra_amount)} додатково
                            </p>
                          )}
                        </div>
                      </div>
                      {i < plan.recommendations.length - 1 && (
                        <div style={{ height: 1, background: 'var(--divider)', margin: '0 20px' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button onClick={() => setStage('budget')} className="btn-secondary">
            Змінити бюджет
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-accent disabled:opacity-50">
            {saving ? 'Збереження…' : 'Обрати стратегію'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  title: string; description: string; selected: boolean; isRecommended?: boolean; onClick: () => void
}

function StrategyCard({ title, description, selected, isRecommended, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card p-[18px] transition-all"
      style={selected ? {
        background: 'rgba(224,103,47,0.06)',
        border: '1.5px solid rgba(224,103,47,0.5)',
        boxShadow: '7px 7px 10px rgba(199,195,186,0.75), -7px -7px 10px rgba(253,251,246,1.0)',
      } : {
        background: 'var(--bg)',
        border: '1.5px solid transparent',
        boxShadow: '7px 7px 10px rgba(199,195,186,0.75), -7px -7px 10px rgba(253,251,246,1.0)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded-icon flex items-center justify-center flex-shrink-0 mt-0.5"
          style={selected ? {
            background: 'var(--bg)',
            boxShadow: '3px 3px 5px rgba(199,195,186,0.7), -3px -3px 5px rgba(253,251,246,1.0)',
          } : {
            background: 'var(--bg)',
            boxShadow: '3px 3px 5px rgba(199,195,186,0.7), -3px -3px 5px rgba(253,251,246,1.0)',
          }}
        >
          {selected && <div className="w-3 h-3 rounded-icon" style={{ background: 'var(--accent)' }} />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
            {isRecommended && (
              <span className="text-[10px] font-bold text-white rounded-pill px-2 py-0.5" style={{ background: 'var(--accent)' }}>
                Рекомендовано
              </span>
            )}
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
      </div>
    </button>
  )
}
