import { useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { useTelegramReady } from './hooks/useTelegram'
import { LandingPage } from './screens/LandingPage'
import { HomeScreen } from './screens/HomeScreen'
import { AddLoanScreen } from './screens/AddLoanScreen'
import { LoanDetailScreen } from './screens/LoanDetailScreen'
import { RecordPaymentScreen } from './screens/RecordPaymentScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StrategyScreen } from './screens/StrategyScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { DebtScreen } from './screens/DebtScreen'
import { ArchiveScreen } from './screens/ArchiveScreen'
import type { LoanDetail } from './api/types'

type Screen =
  | { name: 'home' }
  | { name: 'add-loan'; loanId?: string }
  | { name: 'loan-detail'; loanId: string }
  | { name: 'record-payment'; loanId: string; initialType?: 'regular' | 'extra' }
  | { name: 'settings' }
  | { name: 'strategy' }
  | { name: 'calendar' }
  | { name: 'debt' }
  | { name: 'archive' }

const TABS = [
  { name: 'home',     label: 'Кредити',      icon: HouseIcon },
  { name: 'strategy', label: 'План',         icon: ChartBarIcon },
  { name: 'archive',  label: 'Архів',        icon: ArchiveIcon },
  { name: 'settings', label: 'Ще',           icon: EllipsisIcon },
] as const

type TabName = typeof TABS[number]['name']
const TAB_NAMES: string[] = TABS.map(t => t.name)

function HouseIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function ChartBarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  )
}

function ArchiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

function EllipsisIcon({ active: _active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function TabBar({ current, onTab }: { current: string; onTab: (name: TabName) => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: 'var(--bg)',
        boxShadow: '-2px -2px 8px rgba(253,251,246,0.9), 2px 0 8px rgba(199,195,186,0.4)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map(tab => {
        const active = current === tab.name
        const Icon = tab.icon
        return (
          <button
            key={tab.name}
            onClick={() => onTab(tab.name)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            <Icon active={active} />
            <span
              className="text-[10px] font-semibold"
              style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function App() {
  useTelegramReady()

  if (!WebApp.initData) return <LandingPage />

  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [refreshKey, setRefreshKey] = useState(0)

  const go = (s: Screen) => setScreen(s)
  const home = () => { setScreen({ name: 'home' }); setRefreshKey(k => k + 1) }

  const showTabBar = TAB_NAMES.includes(screen.name)

  const goTab = (name: TabName) => {
    if (name === 'home') home()
    else go({ name })
  }

  const content = (() => {
    switch (screen.name) {
      case 'home':
        return (
          <HomeScreen
            key={refreshKey}
            onAddLoan={() => go({ name: 'add-loan' })}
            onLoanClick={id => go({ name: 'loan-detail', loanId: id })}
            onStrategyClick={() => go({ name: 'strategy' })}
            onCalendarClick={() => go({ name: 'calendar' })}
            onDebtClick={() => go({ name: 'debt' })}
            onArchiveClick={() => go({ name: 'archive' })}
          />
        )
      case 'add-loan':
        return (
          <AddLoanScreen
            editLoanId={screen.loanId}
            onDone={(_loan: LoanDetail) => home()}
            onBack={() => go({ name: 'home' })}
          />
        )
      case 'loan-detail':
        return (
          <LoanDetailScreen
            loanId={screen.loanId}
            onBack={() => go({ name: 'home' })}
            onRecordPayment={(id, initialType) => go({ name: 'record-payment', loanId: id, initialType })}
            onEditLoan={id => go({ name: 'add-loan', loanId: id })}
          />
        )
      case 'record-payment':
        return (
          <RecordPaymentScreen
            loanId={screen.loanId}
            initialType={screen.initialType}
            onDone={() => go({ name: 'loan-detail', loanId: screen.loanId })}
            onBack={() => go({ name: 'loan-detail', loanId: screen.loanId })}
          />
        )
      case 'settings':
        return <SettingsScreen onBack={home} />
      case 'strategy':
        return (
          <StrategyScreen
            onDone={home}
            onBack={home}
            onAddLoan={() => go({ name: 'add-loan' })}
          />
        )
      case 'calendar':
        return (
          <CalendarScreen
            onBack={() => go({ name: 'home' })}
            onLoanClick={id => go({ name: 'loan-detail', loanId: id })}
          />
        )
      case 'debt':
        return (
          <DebtScreen
            onBack={() => go({ name: 'home' })}
            onCalendarClick={() => go({ name: 'calendar' })}
          />
        )
      case 'archive':
        return (
          <ArchiveScreen
            onBack={() => go({ name: 'home' })}
            onLoanClick={id => go({ name: 'loan-detail', loanId: id })}
          />
        )
    }
  })()

  const tabBarHeight = 'calc(4rem + env(safe-area-inset-bottom, 0px))'

  return (
    <>
      <div style={showTabBar ? { paddingBottom: tabBarHeight } : {}}>
        {content}
      </div>
      {showTabBar && <TabBar current={screen.name} onTab={goTab} />}
    </>
  )
}
