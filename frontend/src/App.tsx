/**
 * App — state-based navigation (no URL router needed in Telegram Mini App).
 * The Telegram BackButton handles "go back" for all non-home screens.
 */
import { useState } from 'react'
import { useTelegramReady, useTelegramTheme } from './hooks/useTelegram'
import { HomeScreen } from './screens/HomeScreen'
import { AddLoanScreen } from './screens/AddLoanScreen'
import { LoanDetailScreen } from './screens/LoanDetailScreen'
import { RecordPaymentScreen } from './screens/RecordPaymentScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import type { LoanDetail } from './api/types'

type Screen =
  | { name: 'home' }
  | { name: 'add-loan'; loanId?: string }
  | { name: 'loan-detail'; loanId: string }
  | { name: 'record-payment'; loanId: string }
  | { name: 'settings' }

export default function App() {
  useTelegramReady()
  useTelegramTheme()

  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [refreshKey, setRefreshKey] = useState(0)

  const go = (s: Screen) => setScreen(s)
  const home = () => { setScreen({ name: 'home' }); setRefreshKey(k => k + 1) }

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          key={refreshKey}
          onAddLoan={() => go({ name: 'add-loan' })}
          onLoanClick={id => go({ name: 'loan-detail', loanId: id })}
          onStrategyClick={() => go({ name: 'settings' })}
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
          onRecordPayment={id => go({ name: 'record-payment', loanId: id })}
          onEditLoan={id => go({ name: 'add-loan', loanId: id })}
        />
      )

    case 'record-payment':
      return (
        <RecordPaymentScreen
          loanId={screen.loanId}
          onDone={() => go({ name: 'loan-detail', loanId: screen.loanId })}
          onBack={() => go({ name: 'loan-detail', loanId: screen.loanId })}
        />
      )

    case 'settings':
      return <SettingsScreen onBack={() => go({ name: 'home' })} />
  }
}
