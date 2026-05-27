import { describe, expect, it } from 'vitest'
import { authorizeCronRequest } from './auth'

describe('authorizeCronRequest', () => {
  it('fails closed when no cron secret is configured', () => {
    expect(authorizeCronRequest({ cronSecret: undefined, authHeader: null })).toEqual({
      ok: false,
      status: 500,
      error: 'Cron secret is not configured',
    })
    expect(authorizeCronRequest({ cronSecret: '', authHeader: null })).toEqual({
      ok: false,
      status: 500,
      error: 'Cron secret is not configured',
    })
  })

  it('rejects missing authorization when a cron secret exists', () => {
    expect(authorizeCronRequest({ cronSecret: 'secret', authHeader: null })).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('rejects an invalid bearer token', () => {
    expect(
      authorizeCronRequest({
        cronSecret: 'secret',
        authHeader: 'Bearer wrong',
      }),
    ).toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    })
  })

  it('allows a valid bearer token', () => {
    expect(
      authorizeCronRequest({
        cronSecret: 'secret',
        authHeader: 'Bearer secret',
      }),
    ).toEqual({ ok: true })
  })
})
