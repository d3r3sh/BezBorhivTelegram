/**
 * App — state-based navigation with bottom tab bar for main screens.
 * Detail screens (loan-detail, add-loan, etc.) use Telegram BackButton.
 */
import { useState } from 'react'
import WebApp from '@twa-dev/sdk'
import { useTelegramReady, useTelegramTheme } from './hooks/useTelegram'
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
  { name: 'home',     icon: '🏠', label: 'Головна' },
  { name: 'strategy', icon: '🎯', label: 'План' },
  { name: 'settings', icon: '⚙️', label: 'Налаштування' },
] as const

type TabName = typeof TABS[number]['name']
const TAB_NAMES: string[] = TABS.map(t => t.name)

function TabBar({ current, onTab }: { current: string; onTab: (name: TabName) => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(tab => (
        <button
          key={tab.name}
          onClick={() => onTab(tab.name)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
            ${current === tab.name ? 'text-sage' : 'text-text-secondary'}`}
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          <span className={`text-xs font-medium ${current === tab.name ? 'text-sage' : 'text-text-secondary'}`}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  useTelegramReady()
  useTelegramTheme()

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

  return (
    <>
      {/* Extra bottom padding only when tab bar is visible */}
      <div className={showTabBar ? 'pb-16' : ''}>
        {content}
      </div>
      {showTabBar && <TabBar current={screen.name} onTab={goTab} />}
    </>
  )
}
