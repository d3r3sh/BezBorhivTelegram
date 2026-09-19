import WebApp from '@twa-dev/sdk'
import { JWT_KEY } from '../api/client'

type TabName = 'home' | 'strategy' | 'archive' | 'settings'

interface Tab {
  name: TabName
  label: string
  icon: (active: boolean) => JSX.Element
}

const TABS: Tab[] = [
  {
    name: 'home',
    label: 'Кредити',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    name: 'strategy',
    label: 'План',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    name: 'archive',
    label: 'Архів',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="5" rx="1" />
        <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
        <path d="M10 13h4" />
      </svg>
    ),
  },
  {
    name: 'settings',
    label: 'Ще',
    icon: (_active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
    ),
  },
]

interface Props {
  current: string
  onTab: (name: TabName) => void
}

export function Sidebar({ current, onTab }: Props) {
  const isWebMode = !WebApp.initData && !!localStorage.getItem(JWT_KEY)

  return (
    <aside
      className="hidden md:flex flex-col w-[240px] min-h-screen sticky top-0 flex-shrink-0 px-4 py-8"
      style={{ boxShadow: '4px 0 16px rgba(199,195,186,0.45)', background: 'var(--bg)', zIndex: 30 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-10">
        <div
          className="w-10 h-10 rounded-icon flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: '4px 4px 8px rgba(199,195,186,0.7), -4px -4px 8px rgba(253,251,246,1.0)', background: 'var(--bg)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <span className="font-serif font-semibold text-[20px]" style={{ color: 'var(--text-primary)' }}>
          БезБоргів
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {TABS.map(tab => {
          const active = current === tab.name
          return (
            <button
              key={tab.name}
              onClick={() => onTab(tab.name)}
              className="flex items-center gap-3 px-4 py-3 rounded-card w-full text-left transition-all active:opacity-70"
              style={active ? {
                color: 'var(--accent)',
                background: 'rgba(224,103,47,0.06)',
                boxShadow: '4px 4px 8px rgba(199,195,186,0.55), -4px -4px 8px rgba(253,251,246,0.9)',
              } : {
                color: 'var(--text-secondary)',
              }}
            >
              {tab.icon(active)}
              <span className="text-[15px] font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Logout (web mode only) */}
      {isWebMode && (
        <button
          onClick={() => { localStorage.removeItem(JWT_KEY); window.location.reload() }}
          className="flex items-center gap-3 px-4 py-3 rounded-card w-full text-left active:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-[14px] font-medium">Вийти</span>
        </button>
      )}
    </aside>
  )
}
