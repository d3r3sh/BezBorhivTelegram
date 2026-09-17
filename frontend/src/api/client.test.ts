import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError } from './client'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON on 200', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: '1', name: 'Авто' }), { status: 200 }),
    )
    const result = await apiFetch<{ id: string; name: string }>('/api/loans')
    expect(result.name).toBe('Авто')
  })

  it('returns null on 204', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    const result = await apiFetch<null>('/api/loans/1')
    expect(result).toBeNull()
  })

  it('throws ApiError on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Loan not found' }), { status: 404 }),
    )
    await expect(apiFetch('/api/loans/bad-id')).rejects.toThrow('Loan not found')
  })

  it('sets Content-Type header', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }))
    await apiFetch('/api/loans')
    const [, opts] = mockFetch.mock.calls[0]
    const headers = opts?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sets Authorization header from WebApp.initData', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }))
    await apiFetch('/api/loans')
    const [, opts] = mockFetch.mock.calls[0]
    const headers = opts?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^tma /)
  })

  it('throws ApiError with correct status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }),
    )
    let err: ApiError | null = null
    try {
      await apiFetch('/api/loans')
    } catch (e) {
      err = e as ApiError
    }
    expect(err).not.toBeNull()
    expect(err?.status).toBe(401)
    expect(err?.message).toBe('Unauthorized')
  })
})
