import { useEffect, useState } from 'react'
import { settingsApi } from '../api/settings'
import { formatAmount } from '../utils/format'
import { useBackButton } from '../hooks/useTelegram'
import type { UserSettings, SettingsUpdatePayload } from '../api/types'

interface Props {
  onBack: () => void
}

export function SettingsScreen({ onBack }: Props) {
  useBackButton(onBack)

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get().then(s => { setSettings(s); setLoading(false) })
  }, [])

  const update = async (patch: SettingsUpdatePayload) => {
    if (!settings) return
    setSaving(true)
    const updated = await settingsApi.update(patch)
    setSettings(updated)
    setSaving(false)
  }

  if (loading || !settings) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-3 border-sage-light border-t-sage rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-cream safe-top safe-bottom pb-6">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-text-primary">Налаштування</h1>
      </div>

      <div className="px-4 flex flex-col gap-5">
        {/* Notifications */}
        <Section title="НАГАДУВАННЯ">
          <Toggle
            label="В день платежу"
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

        {/* Budget */}
        <Section title="БЮДЖЕТ">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-text-primary text-sm">На місяць</span>
            <span className="text-text-secondary text-sm">
              {settings.monthly_budget
                ? formatAmount(settings.monthly_budget)
                : 'Не задано'}
            </span>
          </div>
        </Section>

        {/* Strategy */}
        <Section title="СТРАТЕГІЯ">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-text-primary text-sm">Поточна</span>
            <span className="text-text-secondary text-sm">
              {{ none: 'Не обрано', avalanche: 'Лавина', snowball: 'Сніжний ком' }[settings.strategy]}
            </span>
          </div>
        </Section>

        {saving && (
          <p className="text-text-secondary text-xs text-center">Збереження…</p>
        )}
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

function Toggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-text-primary text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors relative
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
