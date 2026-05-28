'use client'

import { Input } from '@/components/ui/input'
import type { Team, GroupMatch } from '@/types'
import { getTeamById } from '@/lib/data/teams'
import { useLocalKickoff } from '@/lib/format-kickoff'
import { TeamFlag } from '@/components/team-flag'

interface GroupMatchCardProps {
  match: GroupMatch
  prediction?: { scoreA?: number; scoreB?: number }
  onPredictionChange: (matchId: number, scoreA: number | undefined, scoreB: number | undefined) => void
  disabled?: boolean
}

const MIN_SCORE = 0
const MAX_SCORE = 99

function clampScore(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value))
}

function TeamColumn({
  team,
  score,
  onChange,
  disabled,
}: {
  team: Team
  score: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
}) {
  // Stepper semantics: a tap on `+` while the score is unset commits the
  // prediction to 1 (the user's first goal) and a tap on `-` drops it to 0,
  // so both buttons are immediately useful from the empty state.
  const handleIncrement = () => {
    if (score === undefined) {
      onChange(1)
      return
    }
    onChange(clampScore(score + 1))
  }

  const handleDecrement = () => {
    if (score === undefined) {
      onChange(0)
      return
    }
    if (score <= MIN_SCORE) return
    onChange(clampScore(score - 1))
  }

  const decrementDisabled = disabled || score === MIN_SCORE
  const incrementDisabled = disabled || score === MAX_SCORE

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <TeamFlag team={team} size={40} className="sm:size-12" />
      <p className="font-medium text-xs sm:text-sm text-center leading-tight w-full truncate">{team.name}</p>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${team.name} score`}
          onClick={handleDecrement}
          disabled={decrementDisabled}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-xl font-semibold leading-none text-foreground/80 transition-colors hover:border-border hover:bg-card hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:size-9 sm:text-lg"
        >
          −
        </button>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={MIN_SCORE}
          max={MAX_SCORE}
          value={score ?? ''}
          onChange={e => {
            const raw = e.target.value
            if (raw === '') {
              onChange(undefined)
              return
            }
            if (raw.length > 1 && raw.startsWith('0')) return
            const parsed = parseInt(raw, 10)
            if (Number.isNaN(parsed)) return
            onChange(clampScore(parsed))
          }}
          disabled={disabled}
          className="w-12 h-10 text-center text-xl font-bold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none sm:h-9"
          placeholder="-"
        />
        <button
          type="button"
          aria-label={`Increase ${team.name} score`}
          onClick={handleIncrement}
          disabled={incrementDisabled}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-xl font-semibold leading-none text-foreground/80 transition-colors hover:border-border hover:bg-card hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:size-9 sm:text-lg"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function GroupMatchCard({ match, prediction, onPredictionChange, disabled }: GroupMatchCardProps) {
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)
  const kickoff = useLocalKickoff(match.date, match.time)

  const handleScoreChange = (side: 'A' | 'B', value: number | undefined) => {
    if (side === 'A') {
      onPredictionChange(match.id, value, prediction?.scoreB)
    } else {
      onPredictionChange(match.id, prediction?.scoreA, value)
    }
  }

  return (
    <div className="rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors overflow-hidden">
      {kickoff && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-card/40 border-b border-border/30">
          <span className="text-[11px] text-muted-foreground">{kickoff.date}</span>
          <span className="text-[11px] font-medium text-muted-foreground/80">{kickoff.time}</span>
        </div>
      )}
      <div className="flex items-stretch p-4 sm:p-5">
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
    </div>
  )
}
