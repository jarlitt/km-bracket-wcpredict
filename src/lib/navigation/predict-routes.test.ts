import { describe, expect, it } from 'vitest'
import { predictSummaryHref } from './predict-routes'

describe('predict routes', () => {
  it('builds the prediction summary href', () => {
    expect(predictSummaryHref()).toBe('/predict/summary')
  })
})
