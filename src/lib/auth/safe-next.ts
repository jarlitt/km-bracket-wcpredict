/**
 * Validate a post-auth `next=` redirect target. We only allow same-origin
 * relative paths so a malicious link can't bounce a freshly-logged-in user
 * to an arbitrary site (open-redirect).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/'
  // Has to be a same-origin path...
  if (!next.startsWith('/')) return '/'
  // ...and not a protocol-relative URL like //evil.example.com.
  if (next.startsWith('//')) return '/'
  return next
}
