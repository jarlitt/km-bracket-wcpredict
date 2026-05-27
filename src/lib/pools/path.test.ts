import { describe, it, expect } from 'vitest'
import {
  rewritePoolPathForSlug,
  isNavLinkActive,
  resolvePoolPredictionLandingPath,
} from './path'

describe('rewritePoolPathForSlug', () => {
  it('returns null when the path is not pool-scoped', () => {
    expect(rewritePoolPathForSlug('/matches', 'malta')).toBeNull()
    expect(rewritePoolPathForSlug('/predict', 'malta')).toBeNull()
    expect(rewritePoolPathForSlug('/dashboard', 'malta')).toBeNull()
    expect(rewritePoolPathForSlug('/pools', 'malta')).toBeNull()
    expect(rewritePoolPathForSlug('/', 'malta')).toBeNull()
  })

  it('rewrites the slug inside /pools/[slug]/predict subtree', () => {
    expect(
      rewritePoolPathForSlug('/pools/spain/predict/groups', 'malta'),
    ).toBe('/pools/malta/predict/groups')
    expect(
      rewritePoolPathForSlug('/pools/spain/predict/bracket', 'malta'),
    ).toBe('/pools/malta/predict/bracket')
  })

  it('rewrites the slug inside /pools/[slug]/dashboard', () => {
    expect(rewritePoolPathForSlug('/pools/spain/dashboard', 'malta')).toBe(
      '/pools/malta/dashboard',
    )
  })

  it('keeps trailing segments intact', () => {
    expect(
      rewritePoolPathForSlug('/pools/spain/predict/summary', 'uk'),
    ).toBe('/pools/uk/predict/summary')
  })

  it('handles a bare pool URL with no trailing segment', () => {
    expect(rewritePoolPathForSlug('/pools/spain', 'malta')).toBe(
      '/pools/malta',
    )
  })
})

describe('isNavLinkActive', () => {
  it('matches /predict for the picker and predict subtree', () => {
    expect(isNavLinkActive('/predict', '/predict')).toBe(true)
    expect(isNavLinkActive('/predict', '/predict/groups')).toBe(true)
    expect(isNavLinkActive('/predict', '/predict/bracket')).toBe(true)
    expect(isNavLinkActive('/predict', '/pools/spain/dashboard')).toBe(false)
    expect(isNavLinkActive('/predict', '/dashboard')).toBe(false)
  })

  it('matches /dashboard for the picker and pool-scoped dashboard', () => {
    expect(isNavLinkActive('/dashboard', '/dashboard')).toBe(true)
    expect(isNavLinkActive('/dashboard', '/pools/spain/dashboard')).toBe(true)
    expect(isNavLinkActive('/dashboard', '/pools/spain/predict/groups')).toBe(
      false,
    )
  })

  it('matches /pools only on the list page, not inside a pool', () => {
    expect(isNavLinkActive('/pools', '/pools')).toBe(true)
    expect(isNavLinkActive('/pools', '/pools/spain/predict/groups')).toBe(
      false,
    )
    expect(isNavLinkActive('/pools', '/pools/spain/dashboard')).toBe(false)
  })

  it('uses prefix matching for other links', () => {
    expect(isNavLinkActive('/matches', '/matches')).toBe(true)
    expect(isNavLinkActive('/matches', '/matches/123')).toBe(true)
    expect(isNavLinkActive('/rules', '/rules')).toBe(true)
    expect(isNavLinkActive('/rules', '/predict')).toBe(false)
  })

  it('matches Home only on the exact root path', () => {
    expect(isNavLinkActive('/', '/')).toBe(true)
    expect(isNavLinkActive('/', '/matches')).toBe(false)
    expect(isNavLinkActive('/', '/pools/spain/predict/groups')).toBe(false)
    expect(isNavLinkActive('/', '/predict')).toBe(false)
  })
})

describe('resolvePoolPredictionLandingPath', () => {
  it('sends submitted pools to the summary', () => {
    expect(
      resolvePoolPredictionLandingPath('spain', {
        submitted: true,
        groupPredictionCount: 10,
        knockoutPredictionCount: 0,
      }),
    ).toBe('/predict/summary')
  })

  it('sends unsubmitted pools with incomplete groups to groups', () => {
    expect(
      resolvePoolPredictionLandingPath('spain', {
        submitted: false,
        groupPredictionCount: 71,
        knockoutPredictionCount: 32,
      }),
    ).toBe('/predict/groups')
  })

  it('sends unsubmitted pools with complete groups to bracket', () => {
    expect(
      resolvePoolPredictionLandingPath('spain', {
        submitted: false,
        groupPredictionCount: 72,
        knockoutPredictionCount: 0,
      }),
    ).toBe('/predict/bracket')
  })

  it('defaults preview pools to groups when no summary exists', () => {
    expect(resolvePoolPredictionLandingPath('spain')).toBe(
      '/predict/groups',
    )
  })
})
