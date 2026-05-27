const PENDING_SUBMIT_KEY = 'wc2026-pending-submit'

export function readPendingSubmit(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(PENDING_SUBMIT_KEY) === '1'
  } catch {
    return false
  }
}

export function writePendingSubmit(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PENDING_SUBMIT_KEY, '1')
  } catch {
    /* ignore private-mode storage failures */
  }
}

export function clearPendingSubmit(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PENDING_SUBMIT_KEY)
  } catch {
    /* ignore private-mode storage failures */
  }
}
