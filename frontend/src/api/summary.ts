import { apiFetch } from './client'
import type { Summary } from './types'

export const summaryApi = {
  get: () => apiFetch<Summary>('/api/summary'),
}
