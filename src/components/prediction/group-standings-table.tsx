'use client'

import type { TeamStanding } from '@/types'
import { cn } from '@/lib/utils'

interface GroupStandingsTableProps {
  groupId: string
  standings: TeamStanding[]
  qualifiedThirdGroups?: string[]
}

export function GroupStandingsTable({ groupId, standings, qualifiedThirdGroups }: GroupStandingsTableProps) {
  const isThirdQualified = qualifiedThirdGroups?.includes(groupId)

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
      <div className="px-4 py-2.5 bg-card/80 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-bold text-sm">Group {groupId}</h3>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[160px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[32px]" />
            <col className="w-[36px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground">
              <th className="sticky left-0 z-10 text-left pl-3 pr-2 py-2 bg-card shadow-[2px_0_4px_-1px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-1">
                  <span className="w-5 text-center text-xs">#</span>
                  <span className="text-xs">Team</span>
                </div>
              </th>
              <th className="text-center text-xs px-0.5 py-2">P</th>
              <th className="text-center text-xs px-0.5 py-2">W</th>
              <th className="text-center text-xs px-0.5 py-2">D</th>
              <th className="text-center text-xs px-0.5 py-2">L</th>
              <th className="text-center text-xs px-0.5 py-2">GF</th>
              <th className="text-center text-xs px-0.5 py-2">GA</th>
              <th className="text-center text-xs px-0.5 py-2">GD</th>
              <th className="text-center text-xs font-bold px-0.5 py-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const qualifies = index < 2 || (index === 2 && isThirdQualified)
              return (
                <tr
                  key={standing.team.id}
                  className={cn(
                    'border-b border-border/20',
                    index < 2 && 'bg-emerald-500/5',
                    index === 2 && isThirdQualified && 'bg-blue-500/5',
                  )}
                >
                  <td className="sticky left-0 z-10 pl-3 pr-2 py-2 overflow-hidden bg-card shadow-[2px_0_4px_-1px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {qualifies ? (
                        <span className={cn(
                          'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0',
                          index < 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        )}>
                          {index + 1}
                        </span>
                      ) : (
                        <span className="w-5 text-center text-xs text-muted-foreground shrink-0">{index + 1}</span>
                      )}
                      <span className="text-base shrink-0">{standing.team.flag}</span>
                      <span className="text-xs font-medium truncate">{standing.team.name}</span>
                    </div>
                  </td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.played}</td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.won}</td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.drawn}</td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.lost}</td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.goalsFor}</td>
                  <td className="text-center text-xs px-0.5 py-2">{standing.goalsAgainst}</td>
                  <td className="text-center text-xs px-0.5 py-2">
                    {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                  </td>
                  <td className="text-center text-sm font-bold px-0.5 py-2">{standing.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-border/30 flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/40" /> Qualifies
        </span>
        {isThirdQualified && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500/40" /> Best 3rd
          </span>
        )}
      </div>
    </div>
  )
}
