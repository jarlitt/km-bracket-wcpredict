'use client'

import { Input } from '@/components/ui/input'
import type { Team, GroupMatch } from '@/types'
import { getTeamById } from '@/lib/data/teams'

interface GroupMatchCardProps {
  match: GroupMatch
  prediction?: { scoreA: number; scoreB: number }
  onPredictionChange: (matchId: number, scoreA: number, scoreB: number) => void
  disabled?: boolean
}

function TeamColumn({
  team,
  score,
  onChange,
  disabled,
}: {
  team: Team
  score: number | undefined
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-3xl sm:text-4xl">{team.flag}</span>
      <p className="font-medium text-xs sm:text-sm text-center leading-tight w-full truncate">{team.name}</p>
      <Input
        type="number"
        min={0}
        max={99}
        value={score ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-14 h-12 text-center text-xl font-bold p-0 mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        placeholder="-"
      />
    </div>
  )
}

export function GroupMatchCard({ match, prediction, onPredictionChange, disabled }: GroupMatchCardProps) {
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)

  const handleScoreChange = (side: 'A' | 'B', value: string) => {
    if (value.length > 1 && value.startsWith('0')) return
    const numValue = value === '' ? 0 : Math.max(0, Math.min(99, parseInt(value) || 0))
    if (side === 'A') {
      onPredictionChange(match.id, numValue, prediction?.scoreB ?? 0)
    } else {
      onPredictionChange(match.id, prediction?.scoreA ?? 0, numValue)
    }
  }

  return (
    <div className="flex items-stretch p-4 sm:p-5 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
      <TeamColumn
        team={teamA}
        score={prediction?.scoreA}
        onChange={v => handleScoreChange('A', v)}
        disabled={disabled}
      />

      <div className="flex items-center justify-center px-3 sm:px-4">
        <span className="text-muted-foreground/60 font-bold text-sm">vs</span>
      </div>

      <TeamColumn
        team={teamB}
        score={prediction?.scoreB}
        onChange={v => handleScoreChange('B', v)}
        disabled={disabled}
      />
    </div>
  )
}
