'use client'

import { cn } from '@/lib/utils'
import { getTeamById } from '@/lib/data/teams'
import type { KnockoutMatch } from '@/types'

interface BracketViewProps {
  matches: KnockoutMatch[]
  predictions: Record<string, number>
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
}

function TeamSlot({
  teamId,
  isWinner,
  onClick,
  disabled,
  placeholder,
}: {
  teamId: number | null
  isWinner: boolean
  onClick?: () => void
  disabled?: boolean
  placeholder?: string
}) {
  const team = teamId ? getTeamById(teamId) : null

  return (
    <button
      onClick={onClick}
      disabled={disabled || !team}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all w-full text-left',
        team && !disabled && 'hover:bg-accent cursor-pointer',
        isWinner && 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
        !isWinner && team && 'bg-card/60',
        !team && 'bg-muted/20 text-muted-foreground/50 cursor-default',
      )}
    >
      {team ? (
        <>
          <span className="text-sm">{team.flag}</span>
          <span className="truncate">{team.code}</span>
        </>
      ) : (
        <span className="text-[10px] truncate">{placeholder || 'TBD'}</span>
      )}
    </button>
  )
}

function MatchCard({
  match,
  winnerId,
  onPickWinner,
  disabled,
}: {
  match: KnockoutMatch
  winnerId: number | null
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
}) {
  const roundLabels: Record<string, string> = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-Final',
    SF: 'Semi-Final',
    '3RD': '3rd Place',
    F: 'Final',
  }

  return (
    <div className="w-36 sm:w-44 shrink-0">
      <p className="text-[9px] text-muted-foreground mb-1 truncate">
        {roundLabels[match.round]} #{match.position}
      </p>
      <div className="rounded-lg border border-border/40 bg-card/40 overflow-hidden">
        <TeamSlot
          teamId={match.teamAId}
          isWinner={winnerId === match.teamAId && match.teamAId !== null}
          onClick={() => match.teamAId && onPickWinner(match.id, match.teamAId)}
          disabled={disabled}
          placeholder={match.label?.split(' vs ')[0]}
        />
        <div className="h-px bg-border/30" />
        <TeamSlot
          teamId={match.teamBId}
          isWinner={winnerId === match.teamBId && match.teamBId !== null}
          onClick={() => match.teamBId && onPickWinner(match.id, match.teamBId)}
          disabled={disabled}
          placeholder={match.label?.split(' vs ')[1]}
        />
      </div>
    </div>
  )
}

export function BracketView({ matches, predictions, onPickWinner, disabled }: BracketViewProps) {
  const rounds = ['R32', 'R16', 'QF', 'SF', 'F'] as const
  const roundLabels: Record<string, string> = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-Finals',
    SF: 'Semi-Finals',
    F: 'Final',
  }

  const thirdPlaceMatch = matches.find(m => m.round === '3RD')

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 sm:gap-8 min-w-max items-start">
          {rounds.map(round => {
            const roundMatches = matches
              .filter(m => m.round === round)
              .sort((a, b) => a.position - b.position)

            return (
              <div key={round} className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {roundLabels[round]}
                </h3>
                <div
                  className="flex flex-col gap-3"
                  style={{
                    paddingTop: round === 'R16' ? '1.5rem' : round === 'QF' ? '4.5rem' : round === 'SF' ? '10rem' : round === 'F' ? '20rem' : 0,
                    gap: round === 'R16' ? '3.5rem' : round === 'QF' ? '9rem' : round === 'SF' ? '20rem' : round === 'F' ? '0' : '0.75rem',
                  }}
                >
                  {roundMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      winnerId={predictions[match.id] ?? null}
                      onPickWinner={onPickWinner}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {thirdPlaceMatch && (
        <div className="border-t border-border/30 pt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            3rd Place Match
          </h3>
          <MatchCard
            match={thirdPlaceMatch}
            winnerId={predictions[thirdPlaceMatch.id] ?? null}
            onPickWinner={onPickWinner}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
