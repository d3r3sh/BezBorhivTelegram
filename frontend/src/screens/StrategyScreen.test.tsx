import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StrategyScreen } from './StrategyScreen'

// Mock all API modules
vi.mock('../api/loans', () => ({
  loansApi: { list: vi.fn() },
}))
vi.mock('../api/plan', () => ({
  planApi: { get: vi.fn() },
}))
vi.mock('../api/settings', () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}))

import { loansApi } from '../api/loans'
import { planApi } from '../api/plan'
import { settingsApi } from '../api/settings'

const noStrategySettings = {
  id: 1, telegram_id: 123, monthly_budget: null,
  strategy: 'none' as const,
  notify_day_of: true, notify_1_day_before: true, notify_3_days_before: false,
}

const withStrategySettings = {
  ...noStrategySettings,
  strategy: 'avalanche' as const,
  monthly_budget: '15000',
}

const emptyPlan = {
  strategy: 'avalanche', recommendations: [], saved_months: 0,
  budget_shortfall: null, closing_date_all: null, closing_dates: {},
}

const loanFixture = {
  id: 'loan-1', name: 'Авто',
  initial_amount: '100000', annual_rate: '24', monthly_payment: '9455.96',
  total_planned_payments: 12, first_payment_date: '2026-09-01', payment_day: 1,
  color_index: 1, is_archived: false, archived_at: null, created_at: '2026-09-01T00:00:00',
  current_balance: '100000', total_debt: '113471.52',
  next_payment_date: '2026-09-01', next_payment_amount: '9455.96',
  payments_made: 0, payments_remaining: 12, is_overdue: false,
}

beforeEach(() => {
  vi.mocked(loansApi.list).mockResolvedValue([])
  vi.mocked(planApi.get).mockResolvedValue(emptyPlan)
  vi.mocked(settingsApi.get).mockResolvedValue(noStrategySettings)
  vi.mocked(settingsApi.update).mockResolvedValue(noStrategySettings as never)
})

describe('StrategyScreen', () => {
  it('shows onboarding when strategy is not set', async () => {
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Оберіть стратегію')).toBeInTheDocument()
    })
  })

  it('shows "Додати кредит" button on onboarding', async () => {
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Додати кредит')).toBeInTheDocument()
    })
  })

  it('shows "Обрати план" only when loans exist', async () => {
    vi.mocked(loansApi.list).mockResolvedValue([loanFixture as never])
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Обрати план')).toBeInTheDocument()
    })
  })

  it('goes directly to result when strategy already set', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(withStrategySettings)
    vi.mocked(planApi.get).mockResolvedValue({
      ...emptyPlan,
      strategy: 'avalanche',
      closing_date_all: '2028-06-01',
    })
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('План')).toBeInTheDocument()
    })
  })

  it('shows both strategy cards in result stage', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(withStrategySettings)
    vi.mocked(planApi.get).mockResolvedValue(emptyPlan)
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Лавина')).toBeInTheDocument()
      expect(screen.getByText('Сніжний ком')).toBeInTheDocument()
    })
  })

  it('shows "Рекомендовано" badge only on Лавина', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(withStrategySettings)
    vi.mocked(planApi.get).mockResolvedValue(emptyPlan)
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Рекомендовано')).toBeInTheDocument()
    })
  })

  it('shows saved_months effect when > 0', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(withStrategySettings)
    vi.mocked(planApi.get).mockResolvedValue({
      ...emptyPlan, saved_months: 5, closing_date_all: '2028-06-01',
    })
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/5 місяців раніше/)).toBeInTheDocument()
    })
  })

  it('shows budget shortfall warning', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(withStrategySettings)
    vi.mocked(planApi.get).mockResolvedValue({
      ...emptyPlan, budget_shortfall: '1234.56',
    })
    render(<StrategyScreen onDone={vi.fn()} onBack={vi.fn()} onAddLoan={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/бюджет менший/i)).toBeInTheDocument()
    })
  })
})
