import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { settingsApi } from '../api/settings'
import { useBackButton } from '../hooks/useTelegram'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { JWT_KEY } from '../api/client'
import type { UserSettings, SettingsUpdatePayload } from '../api/types'

interface Props {
  onBack: () => void
  onLogout?: () => void
}

export function SettingsScreen({ onBack, onLogout }: Props) {
  const isWebMode = !WebApp.initData && !!localStorage.getItem(JWT_KEY)
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
    avalanche: 'Лавина',
    snowball: 'Сніжний ком',
  }

  return (
    <div className="min-h-screen screen-pt" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="px-5 pb-4">
        <h1 className="font-serif font-semibold text-[30px] leading-none" style={{ color: 'var(--text-primary)' }}>
          Ще
        </h1>
      </div>

      <div className="px-5 pb-8 flex flex-col gap-6">

        {/* ── Budget ── */}
        <div>
          <p className="section-header">Бюджет</p>
          <div className="neu-raised rounded-card px-5 py-4 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                Загальна сума на всі кредити
              </p>
              {editingBudget ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="flex-1 text-[17px] font-bold bg-transparent outline-none"
                    style={{ color: 'var(--text-primary)', borderBottom: '2px solid var(--accent)' }}
                    inputMode="decimal"
                    placeholder="0"
                    value={budgetText}
                    onChange={e => setBudgetText(e.target.value)}
                    onBlur={saveBudget}
                    onKeyDown={e => e.key === 'Enter' && saveBudget()}
                  />
                  <span className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>₴</span>
                </div>
              ) : (
                <p className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {budgetText ? `${Number(budgetText).toLocaleString('uk-UA')} ₴` : 'Не задано'}
                </p>
              )}
            </div>
            {!editingBudget && (
              <button
                onClick={() => setEditingBudget(true)}
                className="text-[14px] font-semibold ml-4 active:opacity-60"
                style={{ color: 'var(--accent)' }}
              >
                Змінити
                <svg className="inline ml-1" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Notifications ── */}
        <div>
          <p className="section-header">Нагадування</p>
          <div className="neu-raised rounded-card overflow-hidden">
            <ToggleRow
              label="В день платежу"
              desc="Нагадуємо о 10:00"
              value={settings.notify_day_of}
              onChange={v => update({ notify_day_of: v })}
            />
            <Divider />
            <ToggleRow
              label="За 1 день"
              value={settings.notify_1_day_before}
              onChange={v => update({ notify_1_day_before: v })}
            />
            <Divider />
            <ToggleRow
              label="За 3 дні"
              value={settings.notify_3_days_before}
              onChange={v => update({ notify_3_days_before: v })}
            />
          </div>
        </div>

        {/* ── Strategy ── */}
        <div>
          <p className="section-header">Погашення</p>
          <div className="neu-raised rounded-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  Стратегія
                </p>
                {settings.strategy === 'none' && (
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Оберіть у вкладці «План»
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  {strategyLabel[settings.strategy] ?? 'Не обрано'}
                </span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── About ── */}
        <div>
          <p className="section-header">Про застосунок</p>
          <div className="neu-raised rounded-card px-5 py-4">
            <p className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>БезБоргів</p>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>bezborhiv.com · @bezborhivbot</p>
          </div>
        </div>

        {/* ── Logout (web mode only) ── */}
        {isWebMode && onLogout && (
          <button
            onClick={onLogout}
            className="w-full neu-raised rounded-card px-5 py-4 flex items-center gap-3 active:opacity-70 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[15px] font-medium" style={{ color: 'var(--terracotta)' }}>
              Вийти з акаунту
            </span>
          </button>
        )}

      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--divider)', margin: '0 20px' }} />
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex justify-between items-center px-5 py-4">
      <div>
        <p className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-[52px] h-[30px] rounded-pill relative flex-none ml-4 transition-all duration-200"
        style={value
          ? { background: 'var(--accent)', boxShadow: '5px 7px 10px rgba(216,90,48,0.45), -3px -3px 6px rgba(253,251,246,1.0)' }
          : { boxShadow: 'inset 4px 4px 7px rgba(199,195,186,0.6), inset -4px -4px 7px rgba(253,251,246,1.0)', background: 'var(--bg)' }
        }
      >
        <span
          className="absolute top-[3px] w-6 h-6 rounded-icon transition-transform duration-200"
          style={{
            background: 'var(--bg)',
            boxShadow: '2px 2px 4px rgba(199,195,186,0.8), -2px -2px 4px rgba(253,251,246,1.0)',
            transform: value ? 'translateX(23px)' : 'translateX(3px)',
          }}
        />
      </button>
    </div>
  )
}
