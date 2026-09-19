import { useEffect, useRef } from 'react'
import { API_BASE, JWT_KEY } from '../api/client'

const BOT_NAME = 'bezborhivbot'
const BOT_URL  = 'https://t.me/bezborhivbot'

interface TelegramWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth: (user: TelegramWidgetUser) => void
  }
}

const FEATURES = [
  { icon: '📊', title: 'Всі кредити в одному місці', desc: 'Іпотека, авто, розстрочки — один список' },
  { icon: '🎯', title: 'Стратегія погашення', desc: 'Лавина або Сніжний ком — закрий борги раніше' },
  { icon: '📅', title: 'Календар платежів', desc: 'Наочно бачиш коли і скільки платити' },
  { icon: '🔔', title: 'Нагадування', desc: 'Бот нагадає за 3 дні, 1 день і в день платежу' },
]

interface Props {}

export function LandingPage(_: Props) {
  const callbackRef = useRef<((user: TelegramWidgetUser) => void) | null>(null)

  callbackRef.current = async (user: TelegramWidgetUser) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/telegram-widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      })
      if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
      const { access_token } = await res.json()
      localStorage.setItem(JWT_KEY, access_token)
      window.location.reload()
    } catch (e) {
      console.error('Telegram widget auth failed', e)
    }
  }

  useEffect(() => {
    window.onTelegramAuth = (user) => callbackRef.current?.(user)
    const container = document.getElementById('tg-login-widget')
    if (!container) return
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_NAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '18')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    container.innerHTML = ''
    container.appendChild(script)
    return () => {
      (window as unknown as Record<string, unknown>).onTelegramAuth = undefined
    }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Desktop: 2-column layout ── */}
      <div className="md:flex md:min-h-screen">

        {/* Left column — hero + login */}
        <div className="md:w-[480px] md:flex-shrink-0 md:flex md:flex-col md:justify-center md:sticky md:top-0 md:h-screen px-8 pt-16 pb-10 md:pt-0 md:pb-0 text-center md:text-left">

          {/* Logo */}
          <div className="flex justify-center md:justify-start mb-8">
            <div
              className="w-20 h-20 rounded-icon flex items-center justify-center"
              style={{ boxShadow: '8px 8px 14px rgba(199,195,186,0.75), -8px -8px 14px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
          </div>

          <h1 className="font-serif font-semibold text-[42px] md:text-[48px] leading-tight mb-4" style={{ color: 'var(--text-primary)' }}>
            БезБоргів
          </h1>
          <p className="text-[17px] md:text-[18px] mb-10 max-w-xs mx-auto md:mx-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Відстежуй кредити, плануй погашення і закривай борги швидше
          </p>

          {/* Telegram Login Widget */}
          <div id="tg-login-widget" className="flex justify-center md:justify-start mb-4" />

          <div className="flex items-center gap-4 justify-center md:justify-start mb-4">
            <div className="h-px flex-1 max-w-[80px]" style={{ background: 'var(--divider)' }} />
            <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>або</span>
            <div className="h-px flex-1 max-w-[80px]" style={{ background: 'var(--divider)' }} />
          </div>

          {/* Open in Telegram */}
          <div className="flex justify-center md:justify-start">
            <a
              href={BOT_URL}
              className="inline-flex items-center gap-3 rounded-button px-8 py-4 text-[15px] font-bold text-white active:scale-95 transition-transform"
              style={{ background: 'var(--accent)', boxShadow: '5px 7px 10px rgba(216,90,48,0.45), -3px -3px 6px rgba(253,251,246,1.0)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.367l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.192z"/>
              </svg>
              Відкрити в Telegram
            </a>
          </div>

          <p className="mt-6 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <a href={BOT_URL} className="font-medium" style={{ color: 'var(--accent)' }}>@bezborhivbot</a>
          </p>
        </div>

        {/* Right column — features (desktop only) */}
        <div className="hidden md:flex flex-1 items-center justify-center px-12 py-16">
          <div className="w-full max-w-[480px]">
            <p className="font-serif font-semibold text-[24px] mb-8" style={{ color: 'var(--text-primary)' }}>
              Що вміє застосунок
            </p>
            <div className="grid grid-cols-2 gap-4">
              {FEATURES.map(f => (
                <div
                  key={f.title}
                  className="neu-raised rounded-card p-5"
                >
                  <span className="text-3xl mb-3 block">{f.icon}</span>
                  <p className="font-semibold text-[14px] mb-1" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                  <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile features */}
        <div className="md:hidden px-6 pb-12">
          <div className="neu-raised rounded-card p-6 flex flex-col gap-5 max-w-sm mx-auto">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-4">
                <span className="text-2xl flex-none">{f.icon}</span>
                <div>
                  <p className="font-semibold text-[14px]" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                  <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
