/**
 * Base API client.
 * Adds Authorization: tma <initData> header for every request.
 * Works in Telegram and falls back to empty initData in dev mode.
 */
import WebApp from '@twa-dev/sdk'

// In dev: Vite proxy forwards /api → localhost:8000, so API_BASE stays empty.
// In production (Vercel): set VITE_API_URL to the Railway backend URL.
export const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeader(): Record<string, string> {
  const initData = WebApp.initData
  if (!initData) return {}
  return { Authorization: `tma ${initData}` }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeader(),
    ...(options.headers as Record<string, string> ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 204) return null as T

  const data = await res.json().catch(() => ({ detail: 'Unexpected error' }))

  if (!res.ok) {
    throw new ApiError(res.status, data.detail ?? `HTTP ${res.status}`)
  }

  return data as T
}

export { ApiError }
