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

function TeamDisplay({ team }: { team: Team }) {
  return (
    <div className="flex flex-col items-center gap-1 w-20 sm:w-24">
      <span className="text-2xl sm:text-3xl">{team.flag}</span>
      <p className="font-medium text-xs sm:text-sm text-center leading-tight">{team.name}</p>
    </div>
  )
}

export function GroupMatchCard({ match, prediction, onPredictionChange, disabled }: GroupMatchCardProps) {
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)

  const handleScoreChange = (side: 'A' | 'B', value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, Math.min(99, parseInt(value) || 0))
    if (side === 'A') {
      onPredictionChange(match.id, numValue, prediction?.scoreB ?? 0)
    } else {
      onPredictionChange(match.id, prediction?.scoreA ?? 0, numValue)
    }
  }

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
      <TeamDisplay team={teamA} />

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={99}
          value={prediction?.scoreA ?? ''}
          onChange={e => handleScoreChange('A', e.target.value)}
          disabled={disabled}
          className="w-12 h-12 text-center text-xl font-bold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="-"
        />
        <span className="text-muted-foreground font-bold text-lg">:</span>
        <Input
          type="number"
          min={0}
          max={99}
          value={prediction?.scoreB ?? ''}
          onChange={e => handleScoreChange('B', e.target.value)}
          disabled={disabled}
          className="w-12 h-12 text-center text-xl font-bold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="-"
        />
      </div>

      <TeamDisplay team={teamB} />
    </div>
  )
}
