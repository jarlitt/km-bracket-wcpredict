interface CronAuthInput {
  cronSecret: string | undefined
  authHeader: string | null
}

type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 500; error: 'Cron secret is not configured' }
  | { ok: false; status: 401; error: 'Unauthorized' }

export function authorizeCronRequest({
  cronSecret,
  authHeader,
}: CronAuthInput): CronAuthResult {
  if (!cronSecret) {
    return { ok: false, status: 500, error: 'Cron secret is not configured' }
  }
  if (authHeader === `Bearer ${cronSecret}`) return { ok: true }
  return { ok: false, status: 401, error: 'Unauthorized' }
}
