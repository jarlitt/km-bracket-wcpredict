interface EditNavigationGuardInput {
  editingSubmission: boolean
  currentPathname: string
  destinationHref: string
}

const POOL_PREDICT_PATH_PATTERN = /^\/pools\/([^/]+)\/predict(?:\/|$)/

function pathnameFromHref(href: string): string | null {
  try {
    return new URL(href, 'https://local.app').pathname
  } catch {
    return null
  }
}

export function shouldPromptForEditNavigation({
  editingSubmission,
  currentPathname,
  destinationHref,
}: EditNavigationGuardInput): boolean {
  if (!editingSubmission) return false

  const currentPoolMatch = currentPathname.match(POOL_PREDICT_PATH_PATTERN)
  if (!currentPoolMatch) return false

  const destinationPathname = pathnameFromHref(destinationHref)
  if (!destinationPathname) return true

  const currentPredictionBasePath = `/pools/${currentPoolMatch[1]}/predict`

  return (
    destinationPathname !== currentPredictionBasePath &&
    !destinationPathname.startsWith(`${currentPredictionBasePath}/`)
  )
}
