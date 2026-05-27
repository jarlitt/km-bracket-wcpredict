import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClientMock, recalculateAllScoresMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  recalculateAllScoresMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/scoring/recalculate', () => ({
  recalculateAllScores: recalculateAllScoresMock,
}))

import { GET } from './route'

const originalCronSecret = process.env.CRON_SECRET
const originalFetch = globalThis.fetch

function cronRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/sync-results', {
    headers: authHeader ? { authorization: authHeader } : undefined,
  })
}

async function expectNoSyncWork(): Promise<void> {
  expect(globalThis.fetch).not.toHaveBeenCalled()
  expect(createAdminClientMock).not.toHaveBeenCalled()
  expect(recalculateAllScoresMock).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.CRON_SECRET
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET
  } else {
    process.env.CRON_SECRET = originalCronSecret
  }
  globalThis.fetch = originalFetch
})

describe('GET /api/cron/sync-results authorization', () => {
  it('returns a configuration error when CRON_SECRET is missing', async () => {
    const response = await GET(cronRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Cron secret is not configured',
    })
    await expectNoSyncWork()
  })

  it('returns unauthorized for missing or wrong authorization with a configured secret', async () => {
    process.env.CRON_SECRET = 'secret'

    const missingAuthResponse = await GET(cronRequest())
    expect(missingAuthResponse.status).toBe(401)
    await expect(missingAuthResponse.json()).resolves.toEqual({ error: 'Unauthorized' })
    await expectNoSyncWork()

    vi.clearAllMocks()

    const wrongAuthResponse = await GET(cronRequest('Bearer wrong'))
    expect(wrongAuthResponse.status).toBe(401)
    await expect(wrongAuthResponse.json()).resolves.toEqual({ error: 'Unauthorized' })
    await expectNoSyncWork()
  })

  it('proceeds to fetch with a valid bearer token', async () => {
    process.env.CRON_SECRET = 'secret'
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    } as Response)

    const response = await GET(cronRequest('Bearer secret'))

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      totalEvents: 0,
    })
  })
})
