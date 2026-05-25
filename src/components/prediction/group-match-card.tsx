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

function TeamDisplay({ team, side }: { team: Team; side: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      <span className="text-xl sm:text-2xl shrink-0">{team.flag}</span>
      <div className={`min-w-0 ${side === 'right' ? 'text-right' : ''}`}>
        <p className="font-medium text-sm sm:text-base truncate">{team.name}</p>
        <p className="text-[10px] text-muted-foreground">{team.code}</p>
      </div>
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
    <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
      <div className="flex-1 min-w-0">
        <TeamDisplay team={teamA} side="left" />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Input
          type="number"
          min={0}
          max={99}
          value={prediction?.scoreA ?? ''}
          onChange={e => handleScoreChange('A', e.target.value)}
          disabled={disabled}
          className="w-10 sm:w-12 h-10 sm:h-12 text-center text-lg font-bold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
          className="w-10 sm:w-12 h-10 sm:h-12 text-center text-lg font-bold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="-"
        />
      </div>

      <div className="flex-1 min-w-0">
        <TeamDisplay team={teamB} side="right" />
      </div>
    </div>
  )
}
