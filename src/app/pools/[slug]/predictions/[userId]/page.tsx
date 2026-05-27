import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isTournamentLockedAsync } from '@/lib/matches/lock-server'
import { createClient } from '@/lib/supabase/server'
import { TeamFlag } from '@/components/team-flag'
import { GROUPS, getTeamById } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'

export default async function UserPredictionViewerPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>
}) {
  const { slug, userId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()
  if (!pool) notFound()

  const locked = await isTournamentLockedAsync()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwnBracket = user?.id === userId

  if (!locked && !isOwnBracket) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Predictions not available yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll be able to see other players&apos; predictions once the tournament starts.
        </p>
        <Link href={`/pools/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to {pool.name}
        </Link>
      </main>
    )
  }

  const [{ data: profile }, { data: groupRows }, { data: knockoutRows }] = await Promise.all([
    supabase.from('profiles').select('display_name, country').eq('id', userId).maybeSingle(),
    supabase
      .from('group_predictions')
      .select('match_id, predicted_score_a, predicted_score_b')
      .eq('user_id', userId)
      .eq('pool_id', pool.id),
    supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id')
      .eq('user_id', userId)
      .eq('pool_id', pool.id),
  ])

  if (!profile || (groupRows ?? []).length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Bracket unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This player hasn&apos;t submitted their bracket yet.
        </p>
        <Link href={`/pools/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to {pool.name}
        </Link>
      </main>
    )
  }

  const groupPredMap = new Map(
    (groupRows ?? []).map((r) => [r.match_id, { scoreA: r.predicted_score_a, scoreB: r.predicted_score_b }]),
  )
  const knockoutPredMap = new Map(
    (knockoutRows ?? []).map((r) => [r.match_id, r.predicted_winner_id]),
  )

  const ROUND_LABELS: Record<string, string> = {
    'R32': 'Round of 32',
    'R16': 'Round of 16',
    'QF': 'Quarter-final',
    'SF': 'Semi-final',
    '3RD': '3rd Place',
    'F': 'Final',
  }

  const knockoutByRound = new Map<string, Array<{ matchId: string; winnerId: number }>>()
  for (const [matchId, winnerId] of knockoutPredMap) {
    const round = matchId.split('-')[0]
    if (!knockoutByRound.has(round)) knockoutByRound.set(round, [])
    knockoutByRound.get(round)!.push({ matchId, winnerId })
  }

  const roundOrder = ['R32', 'R16', 'QF', 'SF', '3RD', 'F']

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <Link href={`/pools/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {pool.name}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{profile.display_name}&apos;s bracket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {groupRows?.length ?? 0} group predictions · {knockoutRows?.length ?? 0} knockout picks
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Group Stage</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((groupId) => {
            const matches = getMatchesByGroup(groupId)
            return (
              <div key={groupId} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                <div className="border-b border-border/30 bg-card/60 px-3 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Group {groupId}</h3>
                </div>
                <div className="divide-y divide-border/20">
                  {matches.map((match) => {
                    const pred = groupPredMap.get(match.id)
                    const teamA = getTeamById(match.teamAId)
                    const teamB = getTeamById(match.teamBId)
                    return (
                      <div key={match.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <TeamFlag team={teamA} size={16} />
                          <span className="truncate">{teamA.code}</span>
                        </div>
                        <span className="font-bold tabular-nums">
                          {pred ? `${pred.scoreA ?? '-'} – ${pred.scoreB ?? '-'}` : '– – –'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                          <span className="truncate">{teamB.code}</span>
                          <TeamFlag team={teamB} size={16} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {knockoutPredMap.size > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Knockout Stage</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roundOrder.map((round) => {
              const picks = knockoutByRound.get(round)
              if (!picks || picks.length === 0) return null
              return (
                <div key={round} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  <div className="border-b border-border/30 bg-card/60 px-3 py-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      {ROUND_LABELS[round] ?? round}
                    </h3>
                  </div>
                  <div className="divide-y divide-border/20">
                    {picks.map(({ matchId, winnerId }) => {
                      const team = getTeamById(winnerId)
                      return (
                        <div key={matchId} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <TeamFlag team={team} size={16} />
                          <span className="font-medium">{team.name}</span>
                          <span className="ml-auto text-muted-foreground/60">{matchId}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
