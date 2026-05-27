'use client'

import { getTeamById } from '@/lib/data/teams'
import { useLocalKickoff } from '@/lib/format-kickoff'
import type { GroupMatch } from '@/types'

function MatchRow({ match }: { match: GroupMatch }) {
  const kickoff = useLocalKickoff(match.date, match.time)
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/30 px-4 py-3">
      {kickoff && (
        <div className="flex w-16 shrink-0 flex-col text-center">
          <span className="text-xs text-muted-foreground">{kickoff.date}</span>
          <span className="text-sm font-semibold tabular-nums">
            {kickoff.time}
          </span>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-sm">
          <span>{teamA.flag}</span>
          <span className="hidden sm:inline">{teamA.name}</span>
          <span className="sm:hidden">{teamA.code}</span>
        </span>

        <span className="text-xs text-muted-foreground">vs</span>

        <span className="flex items-center gap-1.5 text-sm">
          <span className="hidden sm:inline">{teamB.name}</span>
          <span className="sm:hidden">{teamB.code}</span>
          <span>{teamB.flag}</span>
        </span>
      </div>

      <span className="shrink-0 rounded-full border border-border/30 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Group {match.groupId}
      </span>
    </div>
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
        {locked ? "Today's Matches" : 'First Matches'}
      </h2>
      <div className="space-y-2">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </section>
  )
}
