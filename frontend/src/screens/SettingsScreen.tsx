import { useEffect, useState } from 'react'
import { settingsApi } from '../api/settings'
import { useBackButton } from '../hooks/useTelegram'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { UserSettings, SettingsUpdatePayload } from '../api/types'

interface Props {
  onBack: () => void
}

export function SettingsScreen({ onBack }: Props) {
  useBackButton(onBack)

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetText, setBudgetText] = useState('')
  const [editingBudget, setEditingBudget] = useState(false)

  useEffect(() => {
    settingsApi.get().then(s => {
      setSettings(s)
      setBudgetText(s.monthly_budget ? String(s.monthly_budget) : '')
      setLoading(false)
    })
  }, [])

  const update = async (patch: SettingsUpdatePayload) => {
    if (!settings) return
    const updated = await settingsApi.update(patch)
    setSettings(updated)
  }

  const saveBudget = async () => {
    setEditingBudget(false)
    const val = budgetText.trim().replace(/\s/g, '')
    const num = parseFloat(val)
    await update({ monthly_budget: val && num > 0 ? val : null })
  }

  if (loading || !settings) return <LoadingSpinner className="h-screen" />

  const strategyLabel: Record<string, string> = {
    none: 'Не обрано',
    avalanche: '🌊 Лавина',
    snowball: '⛄️ Сніжний ком',
  }

  return (
    <div className="min-h-screen bg-cream safe-top">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-text-primary">Налаштування</h1>
      </div>

      <div className="px-4 pb-8 flex flex-col gap-5">

        {/* Budget */}
        <Section title="БЮДЖЕТ НА МІСЯЦЬ">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-text-secondary mb-1">Загальна сума на всі кредити</p>
              {editingBudget ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 text-lg font-bold text-text-primary bg-transparent outline-none border-b border-sage"
                    inputMode="decimal"
                    placeholder="0"
                    value={budgetText}
                    onChange={e => setBudgetText(e.target.value)}
                    onBlur={saveBudget}
                    onKeyDown={e => e.key === 'Enter' && saveBudget()}
                  />
                  <span className="text-text-secondary">₴</span>
                </div>
              ) : (
                <p className="text-lg font-bold text-text-primary">
                  {budgetText ? `${Number(budgetText).toLocaleString('uk-UA')} ₴` : 'Не задано'}
                </p>
              )}
            </div>
            {!editingBudget && (
              <button
                onClick={() => setEditingBudget(true)}
                className="text-sage text-sm font-semibold ml-4 active:opacity-60"
              >
                Змінити
              </button>
            )}
          </div>
        </Section>

        {/* Notifications */}
        <Section title="НАГАДУВАННЯ">
          <Toggle
            label="В день платежу"
            desc="Нагадуємо о 10:00"
            value={settings.notify_day_of}
            onChange={v => update({ notify_day_of: v })}
          />
          <Toggle
            label="За 1 день"
            value={settings.notify_1_day_before}
            onChange={v => update({ notify_1_day_before: v })}
          />
          <Toggle
            label="За 3 дні"
            value={settings.notify_3_days_before}
            onChange={v => update({ notify_3_days_before: v })}
          />
        </Section>

        {/* Strategy info */}
        <Section title="СТРАТЕГІЯ ПОГАШЕННЯ">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {strategyLabel[settings.strategy] ?? 'Не обрано'}
              </p>
              {settings.strategy === 'none' && (
                <p className="text-xs text-text-secondary mt-0.5">Оберіть у вкладці «План»</p>
              )}
            </div>
            {settings.strategy !== 'none' && (
              <span className="text-xs bg-sage-light text-sage font-semibold px-2 py-1 rounded-lg">Активна</span>
            )}
          </div>
        </Section>

        {/* App info */}
        <Section title="ПРО ЗАСТОСУНОК">
          <div className="px-4 py-3.5">
            <p className="text-sm text-text-primary font-medium">БезБоргів</p>
            <p className="text-xs text-text-secondary mt-0.5">bezborhiv.com · @bezborhivbot</p>
          </div>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-text-secondary tracking-widest px-1 mb-2">{title}</p>
      <div className="bg-white rounded-card shadow-card-sm divide-y divide-gray-100">
        {children}
      </div>
    </div>
  )
}

function Toggle({ label, desc, value, onChange }: {
  label: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3.5">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        {desc && <p className="text-xs text-text-secondary mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors relative flex-none ml-4
          ${value ? 'bg-sage' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
            ${value ? 'translate-x-7' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}
