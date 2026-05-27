const POOL_SCOPED_PATH_RE = /^\/pools\/([^/]+)(\/.*)?$/
const COMPLETE_GROUP_PREDICTION_COUNT = 72

interface PoolPredictionLandingSummary {
  submitted: boolean
  groupPredictionCount: number
  knockoutPredictionCount: number
}

/**
 * If `pathname` is a pool-scoped URL (e.g. `/pools/spain/predict/groups`),
 * returns the same URL with the slug swapped for `newSlug`. Otherwise returns
 * `null`, signalling that the caller should not navigate.
 */
export function rewritePoolPathForSlug(
  pathname: string,
  newSlug: string,
): string | null {
  const match = POOL_SCOPED_PATH_RE.exec(pathname)
  if (!match) return null
  const rest = match[2] ?? ''
  return `/pools/${newSlug}${rest}`
}

export function resolvePoolPredictionLandingPath(
  slug: string,
  summary?: PoolPredictionLandingSummary,
): string {
  if (summary?.submitted) return `/pools/${slug}/predict/summary`
  if ((summary?.groupPredictionCount ?? 0) >= COMPLETE_GROUP_PREDICTION_COUNT) {
    return `/pools/${slug}/predict/bracket`
  }
  return `/pools/${slug}/predict/groups`
}

/**
 * Returns true when the given navbar link should be highlighted for the
 * current `pathname`. The non-trivial cases are the per-pool subtrees, which
 * a naive `startsWith` would incorrectly tag as the "Pools" link.
 */
export function isNavLinkActive(linkHref: string, pathname: string): boolean {
  if (linkHref === '/predict') {
    return (
      pathname === '/predict' ||
      /^\/pools\/[^/]+\/predict(\/|$)/.test(pathname)
    )
  }
  if (linkHref === '/dashboard') {
    return (
      pathname === '/dashboard' ||
      /^\/pools\/[^/]+\/dashboard(\/|$)/.test(pathname)
    )
  }
  if (linkHref === '/pools') {
    return pathname === '/pools'
  }
  // Home must match exactly — otherwise every pathname (which starts with
  // '/') would light up the Home tab.
  if (linkHref === '/') {
    return pathname === '/'
  }
  return pathname === linkHref || pathname.startsWith(`${linkHref}/`)
}
