import { describe, expect, it } from 'vitest'
import { shouldPromptForUnsavedChangesNavigation } from './edit-mode-guard'

describe('shouldPromptForUnsavedChangesNavigation', () => {
  it('allows moving between prediction steps', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/predict/bracket',
      }),
    ).toBe(false)
  })

  it('prompts when leaving the predict flow with unsaved changes', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/pools/spain/dashboard',
      }),
    ).toBe(true)

    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(true)
  })

  it('prompts for absolute same-origin links outside the predict flow', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: 'http://localhost:3000/pools/spain/dashboard',
      }),
    ).toBe(true)
  })

  it('does not prompt when there are no unsaved changes', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: false,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(false)
  })
})
