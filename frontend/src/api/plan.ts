import { apiFetch } from './client'

export interface MonthlyRec {
  loan_id: string
  loan_name: string
  mandatory_amount: string | number
  extra_amount: string | number
  total_amount: string | number
}

export interface PlanOut {
  strategy: string
  recommendations: MonthlyRec[]
  saved_months: number
  budget_shortfall: string | number | null
  closing_date_all: string | null
  closing_dates: Record<string, string | null>
}

interface PlanParams {
  strategy?: string
  monthly_budget?: string
}

export const planApi = {
  get: (params?: PlanParams) => {
    const q = new URLSearchParams()
    if (params?.strategy) q.set('strategy', params.strategy)
    if (params?.monthly_budget) q.set('monthly_budget', params.monthly_budget)
    const qs = q.toString() ? `?${q}` : ''
    return apiFetch<PlanOut>(`/api/plan${qs}`)
  },
}
