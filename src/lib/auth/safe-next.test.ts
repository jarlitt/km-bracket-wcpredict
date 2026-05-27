import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safe-next'

describe('safeNextPath', () => {
  it('returns / when the value is missing', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('accepts same-origin relative paths', () => {
    expect(safeNextPath('/predict')).toBe('/predict')
    expect(safeNextPath('/pools/spain/predict/bracket?submit=1')).toBe(
      '/pools/spain/predict/bracket?submit=1',
    )
  })

  it('rejects schemed URLs that could open-redirect to another origin', () => {
    expect(safeNextPath('https://evil.example.com')).toBe('/')
    expect(safeNextPath('http://evil.example.com')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })

  it('rejects protocol-relative URLs (//evil.example.com)', () => {
    expect(safeNextPath('//evil.example.com')).toBe('/')
    expect(safeNextPath('//evil.example.com/path')).toBe('/')
  })

  it('rejects values without a leading slash', () => {
    expect(safeNextPath('predict')).toBe('/')
    expect(safeNextPath('predict/groups')).toBe('/')
  })
})
