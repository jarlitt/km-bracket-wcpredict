'use client'

import { Button } from '@/components/ui/button'
import { TeamFlag } from '@/components/team-flag'
import { getTeamById } from '@/lib/data/teams'
import type { UnresolvedTie } from '@/lib/standings/calculate-standings'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TieBreakerRulesHelp } from '@/components/prediction/tie-breaker-rules-help'

interface TieBreakResolverProps {
  ties: UnresolvedTie[]
  tieBreakResolutions: Record<string, number[]>
  onResolve: (key: string, teamOrder: number[]) => void
  disabled?: boolean
  compact?: boolean
  collapsible?: boolean
}

export function isTieResolved(
  tie: UnresolvedTie,
  tieBreakResolutions: Record<string, number[]>,
): boolean {
  const resolution = tieBreakResolutions[tie.key] ?? []
  const tiedTeamIds = new Set(tie.teamIds)
  return resolution.length === tie.teamIds.length && resolution.every((teamId) => tiedTeamIds.has(teamId))
}

function currentOrder(tie: UnresolvedTie, tieBreakResolutions: Record<string, number[]>): number[] {
  const resolution = tieBreakResolutions[tie.key] ?? []
  const tiedTeamIds = new Set(tie.teamIds)
  const selected = resolution.filter((teamId) => tiedTeamIds.has(teamId))
  const missing = tie.teamIds.filter((teamId) => !selected.includes(teamId))
  return [...selected, ...missing]
}

function moveTeam(order: number[], index: number, direction: -1 | 1): number[] {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= order.length) return order

  const next = [...order]
  const [teamId] = next.splice(index, 1)
  next.splice(nextIndex, 0, teamId)
  return next
}

function tieLabel(tie: UnresolvedTie): string {
  return `Resolve ${tie.groupId === 'third-place' ? '3rd-place ranking tie' : `Group ${tie.groupId} tie`}`
}

export function TieBreakResolver({
  ties,
  tieBreakResolutions,
  onResolve,
  disabled = false,
  compact = false,
  collapsible = false,
}: TieBreakResolverProps) {
  if (ties.length === 0) return null

  return (
    <div className="space-y-3">
      {ties.map((tie) => {
        const order = currentOrder(tie, tieBreakResolutions)
        const label = tieLabel(tie)
        const content = (
          <>
            {!collapsible && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-blue-100">
                    {label}
                  </h3>
                  <TieBreakerRulesHelp type={tie.groupId === 'third-place' ? 'third-place' : 'group'} />
                </div>
                <p className="mt-1 text-xs text-blue-100/80">
                  These teams are still level after the score-based FIFA criteria. Conduct score is not predicted here,
                  so choose the order to use for your bracket.
                </p>
              </div>
            )}

            {collapsible && (
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-blue-100/80">
                  These teams are still level after the score-based FIFA criteria. Conduct score is not predicted here,
                  so choose the order to use for your bracket.
                </p>
                <TieBreakerRulesHelp type={tie.groupId === 'third-place' ? 'third-place' : 'group'} />
              </div>
            )}

            <div className="space-y-1.5">
              {order.map((teamId, index) => {
                const team = getTeamById(teamId)
                return (
                  <div
                    key={teamId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/50 border border-border/40 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                      <TeamFlag team={team} size={16} />
                      <span className="truncate text-xs font-medium">{team.name}</span>
                    </div>
                    {!disabled && (
                      <div className="flex gap-1">
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size={compact ? 'icon-xs' : 'icon-sm'}
                            onClick={() => onResolve(tie.key, moveTeam(order, index, -1))}
                            aria-label={`Move ${team.name} up`}
                          >
                            <ChevronUp />
                          </Button>
                        )}
                        {index < order.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size={compact ? 'icon-xs' : 'icon-sm'}
                            onClick={() => onResolve(tie.key, moveTeam(order, index, 1))}
                            aria-label={`Move ${team.name} down`}
                          >
                            <ChevronDown />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )

        if (collapsible) {
          return (
            <details
              key={tie.key}
              className="group rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-blue-100">
                <span>{label}</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3">
                {content}
              </div>
            </details>
          )
        }

        return (
          <div
            key={tie.key}
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-3"
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
