'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TeamFlag } from '@/components/team-flag'
import { getTeamById } from '@/lib/data/teams'
import { useLocalKickoff } from '@/lib/format-kickoff'
import type { GroupMatch } from '@/types'

function MatchCard({ match }: { match: GroupMatch }) {
  const kickoff = useLocalKickoff(match.date, match.time)
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)

  return (
    <Card className="border-border/40 bg-card/30 py-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {kickoff && (
            <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs">
              <span className="text-muted-foreground">{kickoff.date}</span>
              <span className="text-sm font-semibold tabular-nums">
                {kickoff.time}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 py-0.5 text-sm font-normal">
              <TeamFlag team={teamA} size={18} className="size-[18px]" />
              <span className="truncate">{teamA.name}</span>
            </div>
            <div className="flex items-center gap-2 py-0.5 text-sm font-normal">
              <TeamFlag team={teamB} size={18} className="size-[18px]" />
              <span className="truncate">{teamB.name}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-1 text-sm font-bold tabular-nums">
            <span className="flex h-7 w-8 items-center justify-center rounded border border-border/50 bg-background/40 text-muted-foreground/60">
              -
            </span>
            <span className="flex h-7 w-8 items-center justify-center rounded border border-border/50 bg-background/40 text-muted-foreground/60">
              -
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function UpcomingMatches({
  matches,
  locked,
}: {
  matches: GroupMatch[]
  locked: boolean
}) {
  if (matches.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        {locked ? "Today's Matches" : 'Next Matches'}
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </section>
  )
}
