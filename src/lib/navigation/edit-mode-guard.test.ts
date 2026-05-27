import { describe, expect, it } from 'vitest'
import { shouldPromptForEditNavigation } from './edit-mode-guard'

describe('shouldPromptForEditNavigation', () => {
  it('allows moving between prediction steps in the same pool', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/pools/spain/predict/bracket',
      }),
    ).toBe(false)
  })

  it('prompts when edit mode would be abandoned', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/pools/spain/dashboard',
      }),
    ).toBe(true)

    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/pools/france/predict/groups',
      }),
    ).toBe(true)

    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/pools/france/predict/summary',
      }),
    ).toBe(true)

    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(true)
  })

  it('prompts for absolute same-origin links outside the current predict flow', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: 'http://localhost:3000/pools/spain/dashboard',
      }),
    ).toBe(true)
  })

  it('does not prompt when not editing a submitted pool', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: false,
        currentPathname: '/pools/spain/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(false)
  })
})
