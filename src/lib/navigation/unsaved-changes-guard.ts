interface UnsavedChangesNavigationGuardInput {
  hasUnsavedChanges: boolean
  currentPathname: string
  destinationHref: string
}

const PREDICT_PATH_PATTERN = /^\/predict(?:\/|$)/

function pathnameFromHref(href: string): string | null {
  try {
    return new URL(href, 'https://local.app').pathname
  } catch {
    return null
  }
}

export function shouldPromptForUnsavedChangesNavigation({
  hasUnsavedChanges,
  currentPathname,
  destinationHref,
}: UnsavedChangesNavigationGuardInput): boolean {
  if (!hasUnsavedChanges) return false

  if (!PREDICT_PATH_PATTERN.test(currentPathname)) return false

  const destinationPathname = pathnameFromHref(destinationHref)
  if (!destinationPathname) return true

  return (
    destinationPathname !== '/predict' &&
    !destinationPathname.startsWith('/predict/')
  )
}
