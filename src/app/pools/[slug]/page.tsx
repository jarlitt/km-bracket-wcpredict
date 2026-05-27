import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PoolFlag } from '@/components/pools/pool-flag'
import { createClient } from '@/lib/supabase/server'

export default async function CountryPoolPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: pool } = await supabase
    .from('pools')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle()
  if (!pool) notFound()

  const [{ data: scoreRows }, { data: submissionRows }] = await Promise.all([
    supabase
      .from('user_scores')
      .select('user_id, total_score, profiles!inner(display_name, country)')
      .eq('pool_id', pool.id)
      .order('total_score', { ascending: false }),
    supabase
      .from('submissions')
      .select('user_id, profiles!inner(display_name, country)')
      .eq('pool_id', pool.id),
  ])

  type PlayerRow = {
    user_id: string
    total_score: number
    profiles: { display_name: string; country: string } | Array<{ display_name: string; country: string }>
  }

  const scoredIds = new Set((scoreRows ?? []).map((r) => r.user_id))
  const fromScores: PlayerRow[] = (scoreRows ?? []) as PlayerRow[]
  const fromSubmissions: PlayerRow[] = ((submissionRows ?? []) as Array<{
    user_id: string
    profiles: { display_name: string; country: string } | Array<{ display_name: string; country: string }>
  }>)
    .filter((r) => !scoredIds.has(r.user_id))
    .map((r) => ({ user_id: r.user_id, total_score: 0, profiles: r.profiles }))

  const players = [...fromScores, ...fromSubmissions]
  const total = players.reduce((sum, row) => sum + (row.total_score ?? 0), 0)
  const avg = players.length === 0 ? 0 : total / players.length

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-xl border border-border/50 bg-card/50 p-5">
        <div className="flex items-center gap-3">
          <PoolFlag slug={slug} size={40} />
          <div>
            <h1 className="text-2xl font-bold">{pool.name}</h1>
            <p className="text-sm text-muted-foreground">
              Average {avg.toFixed(1)} · {players.length} submitted members · Total {total}
            </p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {players.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No submissions yet.
          </p>
        ) : (
          players.map((row, index) => {
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
            const displayName = profile?.display_name ?? 'Unknown'

            return (
              <Link
                key={row.user_id}
                href={`/pools/${slug}/predictions/${row.user_id}`}
                className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/30"
              >
                <span className="w-8 text-sm font-bold text-muted-foreground">#{index + 1}</span>
                <span className="flex-1 text-sm font-medium">{displayName}</span>
                <span className="text-sm font-bold">{row.total_score}</span>
              </Link>
            )
          })
        )}
      </section>

      <div className="text-center">
        <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Leaderboard
        </Link>
      </div>
    </main>
  )
}
