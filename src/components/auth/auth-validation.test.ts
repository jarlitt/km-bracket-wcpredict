import { describe, expect, it } from 'vitest'
import { isOfficeCountrySlug, validateSignupFields } from './auth-validation'

describe('signup validation', () => {
  it('requires an office country', () => {
    const errors = validateSignupFields({
      displayName: 'Jorge',
      email: 'jorge@example.com',
      password: 'password123',
      country: '',
    })
    expect(errors.country).toBe('Office country is required')
  })

  it('rejects invalid country slugs', () => {
    expect(isOfficeCountrySlug('argentina')).toBe(false)
    expect(isOfficeCountrySlug('spain')).toBe(true)
    expect(isOfficeCountrySlug('south-africa')).toBe(true)
  })

  it('returns empty object for valid input', () => {
    const errors = validateSignupFields({
      displayName: 'Jorge',
      email: 'jorge@example.com',
      password: 'password123',
      country: 'spain',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
