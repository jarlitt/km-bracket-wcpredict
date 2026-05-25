'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="w-8 text-center text-xs">#</TableHead>
            <TableHead className="text-xs">Team</TableHead>
            <TableHead className="w-8 text-center text-xs">P</TableHead>
            <TableHead className="w-8 text-center text-xs">W</TableHead>
            <TableHead className="w-8 text-center text-xs">D</TableHead>
            <TableHead className="w-8 text-center text-xs">L</TableHead>
            <TableHead className="w-10 text-center text-xs">GD</TableHead>
            <TableHead className="w-10 text-center text-xs font-bold">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((standing, index) => {
            const qualifies = index < 2 || (index === 2 && isThirdQualified)
            return (
              <TableRow
                key={standing.team.id}
                className={cn(
                  'border-border/20',
                  index < 2 && 'bg-emerald-500/5',
                  index === 2 && isThirdQualified && 'bg-blue-500/5',
                )}
              >
                <TableCell className="text-center text-xs font-medium">
                  {qualifies ? (
                    <span className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                      index < 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                    )}>
                      {index + 1}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{index + 1}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{standing.team.flag}</span>
                    <span className="text-xs sm:text-sm font-medium">{standing.team.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-xs">{standing.played}</TableCell>
                <TableCell className="text-center text-xs">{standing.won}</TableCell>
                <TableCell className="text-center text-xs">{standing.drawn}</TableCell>
                <TableCell className="text-center text-xs">{standing.lost}</TableCell>
                <TableCell className="text-center text-xs">
                  {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                </TableCell>
                <TableCell className="text-center text-sm font-bold">{standing.points}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
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
