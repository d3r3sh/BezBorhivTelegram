export interface ScheduledPayment {
  number: number
  date: string
  amount: string | number
  principal: string | number
  interest: string | number
  balance: string | number
}

export interface Payment {
  id: string
  loan_id: string
  planned_date: string | null
  planned_amount: string | number
  actual_date: string | null
  actual_amount: string | number
  is_extra: boolean
  principal_part: string | number
  interest_part: string | number
  created_at: string
}

export interface Loan {
  id: string
  name: string
  initial_amount: string | number
  annual_rate: string | number
  monthly_payment: string | number
  total_planned_payments: number
  first_payment_date: string
  payment_day: number
  color_index: number
  is_archived: boolean
  archived_at: string | null
  created_at: string
  // Computed
  current_balance: string | number
  total_debt: string | number
  next_payment_date: string | null
  next_payment_amount: string | number | null
  payments_made: number
  payments_remaining: number
  is_overdue: boolean
}

export interface LoanDetail extends Loan {
  schedule: ScheduledPayment[]
}

export interface UserSettings {
  id: number
  telegram_id: number
  monthly_budget: string | number | null
  strategy: 'none' | 'avalanche' | 'snowball'
  notify_day_of: boolean
  notify_1_day_before: boolean
  notify_3_days_before: boolean
}

export interface Summary {
  active_loan_count: number
  total_debt: string | number
  total_body: string | number
  min_monthly: string | number
  recommended_monthly: string | number | null
  remaining_this_month: string | number
  strategy: string
}

// Request payloads
export interface LoanCreatePayload {
  name: string
  is_already_paying: boolean
  initial_amount: string
  total_planned_payments: number
  input_mode: 'rate' | 'payment'
  annual_rate?: string
  monthly_payment?: string
  first_payment_date: string
  color_index?: number
}

export interface LoanUpdatePayload {
  name?: string
  initial_amount?: string
  total_planned_payments?: number
  input_mode?: 'rate' | 'payment'
  annual_rate?: string
  monthly_payment?: string
  first_payment_date?: string
  color_index?: number
}

export interface PaymentCreatePayload {
  actual_date: string
  actual_amount: string
  is_extra?: boolean
  planned_date?: string
  planned_amount?: string
}

export interface SettingsUpdatePayload {
  monthly_budget?: string | null
  strategy?: 'none' | 'avalanche' | 'snowball'
  notify_day_of?: boolean
  notify_1_day_before?: boolean
  notify_3_days_before?: boolean
}
