import { beforeEach, describe, expect, it, vi } from 'vitest'

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  })),
}))

import { GET } from './route'

function callbackRequest(next: string): Request {
  const url = new URL('https://bracket.example.com/auth/callback')
  url.searchParams.set('code', 'auth-code')
  url.searchParams.set('next', next)

  return new Request(url)
}

describe('auth callback route', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset()
  })

  it('redirects to the same-origin next path after successful session exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(callbackRequest('/pools/world-cup/predict'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(response.headers.get('location')).toBe(
      'https://bracket.example.com/pools/world-cup/predict',
    )
  })

  it('redirects absolute next URLs to the origin root', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(callbackRequest('https://evil.example.com'))

    expect(response.headers.get('location')).toBe('https://bracket.example.com/')
  })

  it('redirects protocol-relative next URLs to the origin root', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(callbackRequest('//evil.example.com'))

    expect(response.headers.get('location')).toBe('https://bracket.example.com/')
  })

  it('redirects failed session exchanges to the login page', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') })

    const response = await GET(callbackRequest('/pools/world-cup/predict'))

    expect(response.headers.get('location')).toBe('https://bracket.example.com/auth/login')
  })

  it('redirects failed password recovery exchanges to a recovery-specific error', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid code') })

    const response = await GET(callbackRequest('/auth/reset-password'))

    expect(response.headers.get('location')).toBe(
      'https://bracket.example.com/auth/reset-password?error=link_expired',
    )
  })
})
