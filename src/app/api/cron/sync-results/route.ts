import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron/auth'
import { syncResults } from '@/lib/sync/sync-results'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = authorizeCronRequest({
    cronSecret: process.env.CRON_SECRET,
    authHeader: request.headers.get('authorization'),
  })
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const result = await syncResults()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('sync-results error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
