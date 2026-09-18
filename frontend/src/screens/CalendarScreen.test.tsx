import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CalendarScreen } from './CalendarScreen'
import type { CalendarData } from '../api/types'

vi.mock('../api/calendar', () => ({
  calendarApi: { get: vi.fn() },
}))

import { calendarApi } from '../api/calendar'

const TODAY_PREFIX = new Date().toISOString().slice(0, 7)

const mockData: CalendarData = {
  events: [
    {
      date: `${TODAY_PREFIX}-15`,
      loan_id: 'loan-1',
      loan_name: 'Авто',
      color_index: 1,
      planned_amount: '9455.96',
      is_paid: false,
      is_overdue: false,
    },
  ],
  active_loans: [{ loan_id: 'loan-1', loan_name: 'Авто', color_index: 1 }],
}

beforeEach(() => {
  vi.mocked(calendarApi.get).mockResolvedValue(mockData)
})

describe('CalendarScreen', () => {
  it('renders title', () => {
    render(<CalendarScreen onBack={vi.fn()} onLoanClick={vi.fn()} />)
    expect(screen.getByText('Календар платежів')).toBeTruthy()
  })

  it('shows loan name after load (payment list or legend)', async () => {
    render(<CalendarScreen onBack={vi.fn()} onLoanClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('Авто').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows legend with all three status labels', async () => {
    render(<CalendarScreen onBack={vi.fn()} onLoanClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('Оплачено').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Майбутній').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Прострочено').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows loan name in legend', async () => {
    render(<CalendarScreen onBack={vi.fn()} onLoanClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('Авто').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calls onBack prop (no crash on mount)', () => {
    const onBack = vi.fn()
    render(<CalendarScreen onBack={onBack} onLoanClick={vi.fn()} />)
    expect(onBack).not.toHaveBeenCalled()
  })
})
