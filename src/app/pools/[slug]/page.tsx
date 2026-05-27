import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PoolFlag } from '@/components/pools/pool-flag'
import { isTournamentLockedAsync } from '@/lib/matches/lock'
import { createClient } from '@/lib/supabase/server'

export default async function CountryPoolPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const locked = await isTournamentLockedAsync()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle()
  if (!pool) notFound()

  const { data: rows } = await supabase
    .from('user_scores')
    .select('user_id, total_score, profiles!inner(display_name, country)')
    .eq('profiles.country', slug)
    .order('total_score', { ascending: false })

  const players = (rows ?? []) as Array<{
    user_id: string
    total_score: number
    profiles: { display_name: string; country: string } | Array<{ display_name: string; country: string }>
  }>

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

            const content = (
              <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0">
                <span className="w-8 text-sm font-bold text-muted-foreground">#{index + 1}</span>
                <span className="flex-1 text-sm font-medium">{displayName}</span>
                <span className="text-sm font-bold">{row.total_score}</span>
              </div>
            )

            return locked ? (
              <Link
                key={row.user_id}
                href={`/pools/${slug}/predictions/${row.user_id}`}
                className="block transition-colors hover:bg-muted/30"
              >
                {content}
              </Link>
            ) : (
              <div key={row.user_id}>{content}</div>
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
