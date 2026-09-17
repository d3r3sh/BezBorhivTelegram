import { apiFetch } from './client'
import type { Payment, PaymentCreatePayload } from './types'

export const paymentsApi = {
  list: (loanId: string) =>
    apiFetch<Payment[]>(`/api/loans/${loanId}/payments`),
  record: (loanId: string, data: PaymentCreatePayload) =>
    apiFetch<Payment>(`/api/loans/${loanId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (loanId: string, paymentId: string, data: Partial<PaymentCreatePayload>) =>
    apiFetch<Payment>(`/api/loans/${loanId}/payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (loanId: string, paymentId: string) =>
    apiFetch<null>(`/api/loans/${loanId}/payments/${paymentId}`, { method: 'DELETE' }),
}
