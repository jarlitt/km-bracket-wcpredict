import Link from 'next/link'
import { GlobalPlayerTable } from '@/components/leaderboard/global-player-table'
import { PoolFlag } from '@/components/pools/pool-flag'
import { aggregateLeaderboard } from '@/lib/leaderboard/aggregate'
import { isTournamentLockedAsync } from '@/lib/matches/lock-server'
import { createClient } from '@/lib/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const locked = await isTournamentLockedAsync()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: scores }, { data: profiles }, { data: pools }, { data: submissions }, { data: members }] = await Promise.all([
    supabase.from('user_scores').select('user_id, pool_id, total_score'),
    supabase.from('profiles').select('id, display_name, country'),
    supabase.from('pools').select('id, slug, name').eq('is_active', true),
    supabase.from('submissions').select('user_id, pool_id'),
    supabase.from('pool_members').select('user_id, pool_id'),
  ])

  const { countryStandings, globalPlayers } = aggregateLeaderboard(
    scores ?? [],
    profiles ?? [],
    pools ?? [],
    submissions ?? [],
    members ?? [],
  )

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Compare offices by average score and see the global player ranking.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {countryStandings.map((entry, index) => (
          <Link
            key={entry.slug}
            href={`/pools/${entry.slug}`}
            className="group rounded-xl border border-border/50 bg-card/50 p-4 transition-colors hover:bg-card/80"
          >
            <div className="flex items-center gap-3">
              <PoolFlag slug={entry.slug} size={36} />
              <div>
                <p className="text-xs font-medium text-muted-foreground">#{index + 1}</p>
                <h2 className="font-semibold">{entry.name}</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Avg</p>
                <p className="font-bold">{entry.avgScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold">{entry.totalScore}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Members</p>
                <p className="font-bold">{entry.totalMembers}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Global Player Ranking</h2>
        <GlobalPlayerTable
          players={globalPlayers}
          countries={countryStandings.map(({ slug, name }) => ({ slug, name }))}
          locked={locked}
          currentUserId={user?.id}
        />
      </section>
    </main>
  )
}
