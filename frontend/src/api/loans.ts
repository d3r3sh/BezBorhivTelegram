import { apiFetch } from './client'
import type { Loan, LoanDetail, LoanCreatePayload, LoanUpdatePayload } from './types'

export const loansApi = {
  list: () => apiFetch<Loan[]>('/api/loans'),
  archived: () => apiFetch<Loan[]>('/api/loans/archived'),
  get: (id: string) => apiFetch<LoanDetail>(`/api/loans/${id}`),
  create: (data: LoanCreatePayload) =>
    apiFetch<LoanDetail>('/api/loans', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: LoanUpdatePayload) =>
    apiFetch<LoanDetail>(`/api/loans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<null>(`/api/loans/${id}`, { method: 'DELETE' }),
  archive: (id: string) =>
    apiFetch<Loan>(`/api/loans/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) =>
    apiFetch<Loan>(`/api/loans/${id}/unarchive`, { method: 'POST' }),
}
