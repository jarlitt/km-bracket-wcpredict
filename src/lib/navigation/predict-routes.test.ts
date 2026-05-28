import { describe, expect, it } from 'vitest'
import {
  predictGroupsHref,
  predictSummaryHref,
  resolveSelectedGroup,
} from './predict-routes'

describe('predict routes', () => {
  it('builds the prediction summary href', () => {
    expect(predictSummaryHref()).toBe('/predict/summary')
  })

  it('builds the groups href with no selection', () => {
    expect(predictGroupsHref()).toBe('/predict/groups')
  })

  it('builds the groups href for a group letter', () => {
    expect(predictGroupsHref('C')).toBe('/predict/groups?group=C')
  })

  it('builds the groups href for the thirds tab', () => {
    expect(predictGroupsHref('thirds')).toBe('/predict/groups?group=thirds')
  })
})

describe('resolveSelectedGroup', () => {
  it('accepts a valid group letter as canonical', () => {
    expect(resolveSelectedGroup('F', [])).toEqual({ value: 'F', canonical: true })
  })

  it('accepts the thirds value as canonical', () => {
    expect(resolveSelectedGroup('thirds', [])).toEqual({
      value: 'thirds',
      canonical: true,
    })
  })

  it('falls back to the first incomplete group when the param is missing', () => {
    expect(resolveSelectedGroup(null, ['A', 'B', 'C'])).toEqual({
      value: 'D',
      canonical: false,
    })
  })

  it('falls back to Group A when every group is complete', () => {
    const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    expect(resolveSelectedGroup(undefined, allGroups)).toEqual({
      value: 'A',
      canonical: false,
    })
  })

  it('treats an unknown param as missing and resolves the default', () => {
    expect(resolveSelectedGroup('Z', [])).toEqual({ value: 'A', canonical: false })
    expect(resolveSelectedGroup('', ['A'])).toEqual({ value: 'B', canonical: false })
  })
})
