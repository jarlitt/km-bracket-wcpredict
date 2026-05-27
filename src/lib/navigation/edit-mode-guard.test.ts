import { describe, expect, it } from 'vitest'
import { shouldPromptForEditNavigation } from './edit-mode-guard'

describe('shouldPromptForEditNavigation', () => {
  it('allows moving between prediction steps', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/predict/groups',
        destinationHref: '/predict/bracket',
      }),
    ).toBe(false)
  })

  it('prompts when edit mode would be abandoned', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/predict/groups',
        destinationHref: '/pools/spain/dashboard',
      }),
    ).toBe(true)

    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(true)
  })

  it('prompts for absolute same-origin links outside the predict flow', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: true,
        currentPathname: '/predict/groups',
        destinationHref: 'http://localhost:3000/pools/spain/dashboard',
      }),
    ).toBe(true)
  })

  it('does not prompt when not editing', () => {
    expect(
      shouldPromptForEditNavigation({
        editingSubmission: false,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(false)
  })
})
