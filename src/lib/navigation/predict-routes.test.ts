import { describe, expect, it } from 'vitest'
import { predictSummaryHref } from './predict-routes'

describe('predict routes', () => {
  it('builds the pool prediction summary href', () => {
    expect(predictSummaryHref('spain')).toBe('/pools/spain/predict/summary')
  })
})
