const PENDING_SUBMIT_PREFIX = 'wc2026-pending-submit'

function pendingSubmitKey(poolSlug: string): string {
  return `${PENDING_SUBMIT_PREFIX}:${poolSlug}`
}

export function readPendingSubmit(poolSlug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(pendingSubmitKey(poolSlug)) === '1'
  } catch {
    return false
  }
}

export function writePendingSubmit(poolSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(pendingSubmitKey(poolSlug), '1')
  } catch {
    /* ignore private-mode storage failures */
  }
}

export function clearPendingSubmit(poolSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(pendingSubmitKey(poolSlug))
  } catch {
    /* ignore private-mode storage failures */
  }
}
