import { apiFetch } from './client'
import type { CalendarData } from './types'

export const calendarApi = {
  get(fromDate?: string, months = 24): Promise<CalendarData> {
    const q = new URLSearchParams()
    if (fromDate) q.set('from_date', fromDate)
    q.set('months', String(months))
    return apiFetch<CalendarData>(`/api/calendar?${q}`)
  },
}
