'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import {
  getMatchPredictions,
  type MatchPredictionsPayload,
} from '@/app/actions/match-predictions'
import type { LiveMatch } from '@/lib/espn/matches'
import { TeamFlag } from '@/components/team-flag'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: LiveMatch
}

export function MatchPredictionsSheet({ open, onOpenChange, match }: Props) {
  const { user } = useAuth()
  const { userPool } = usePools()

  const selectedPool = userPool

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MatchPredictionsPayload>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !match.internalId || !selectedPool || !user) return

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })

    getMatchPredictions(
      match.internalId.type,
      match.internalId.matchId,
      selectedPool.id,
    )
      .then((payload) => {
        if (cancelled) return
        setData(payload)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, match.internalId, selectedPool, user])

  const homeLabel = match.home.team?.name ?? match.home.name
  const awayLabel = match.away.team?.name ?? match.away.name

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Predictions</SheetTitle>
          <SheetDescription className="flex items-center gap-2 pt-1">
            <TeamFlag team={match.home.team} size={18} />
            <span className="font-medium text-foreground">{homeLabel}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-medium text-foreground">{awayLabel}</span>
            <TeamFlag team={match.away.team} size={18} />
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {!match.internalId ? (
            <EmptyState>This match isn&apos;t tracked yet.</EmptyState>
          ) : !user ? (
            <EmptyState>
              Sign in to see how the rest of your pool is predicting this
              match.
            </EmptyState>
          ) : !selectedPool ? (
            <EmptyState>Join a pool to see other members&apos; predictions.</EmptyState>
          ) : loading ? (
            <EmptyState>Loading predictions...</EmptyState>
          ) : error ? (
            <EmptyState className="text-red-400">{error}</EmptyState>
          ) : !data ? (
            <EmptyState>No predictions found.</EmptyState>
          ) : data.predictions.length === 0 ? (
            <EmptyState>No one in {selectedPool.name} has predicted this match yet.</EmptyState>
          ) : data.type === 'group' ? (
            <GroupPredictionsList data={data} currentUserId={user?.id} />
          ) : (
            <KnockoutPredictionsList data={data} currentUserId={user?.id} />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('py-10 text-center text-sm text-muted-foreground', className)}>
      {children}
    </div>
  )
}

function GroupPredictionsList({
  data,
  currentUserId,
}: {
  data: Extract<MatchPredictionsPayload, { type: 'group' }>
  currentUserId?: string
}) {
  const hasResult = data.actualScoreA !== null && data.actualScoreB !== null

  return (
    <div className="space-y-4">
      {hasResult && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
          Actual result: <span className="font-bold text-foreground">{data.actualScoreA} - {data.actualScoreB}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
        <span>Player</span>
        <span className="text-center">Prediction</span>
        <span className="text-right">Pts</span>
      </div>

      <div className="space-y-1">
        {data.predictions.map((p) => (
          <div
            key={p.userId}
            className={cn(
              'grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-2 text-sm',
              p.userId === currentUserId && 'bg-primary/5 ring-1 ring-primary/20',
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{p.displayName}</span>
              {p.userId === currentUserId && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">You</Badge>
              )}
            </div>

            <div className="flex items-center gap-1 tabular-nums">
              <span className={cn('font-semibold', p.exactScore && 'text-emerald-400')}>
                {p.predictedScoreA} - {p.predictedScoreB}
              </span>
              {hasResult && (
                <span className="ml-1">
                  {p.exactScore ? (
                    <DoubleCheck />
                  ) : p.outcomeCorrect ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <X className="size-3.5 text-muted-foreground/50" />
                  )}
                </span>
              )}
            </div>

            <div className="text-right">
              {hasResult ? (
                <span
                  className={cn(
                    'tabular-nums font-bold',
                    p.points > 0 ? 'text-emerald-400' : 'text-muted-foreground/60',
                  )}
                >
                  {p.points > 0 ? `+${p.points}` : '0'}
                </span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ScoringFooter
        rules={[
          'Correct outcome (W/D/L): +3 pts',
          'Exact scoreline: +2 pts bonus',
        ]}
      />
    </div>
  )
}

function KnockoutPredictionsList({
  data,
  currentUserId,
}: {
  data: Extract<MatchPredictionsPayload, { type: 'knockout' }>
  currentUserId?: string
}) {
  const hasResult = data.actualWinnerId !== null

  return (
    <div className="space-y-4">
      {hasResult && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
          Actual winner: <span className="font-bold text-foreground">{data.actualWinnerName}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
        <span>Player</span>
        <span className="text-center">Predicted winner</span>
        <span className="text-right">Pts</span>
      </div>

      <div className="space-y-1">
        {data.predictions.map((p) => (
          <div
            key={p.userId}
            className={cn(
              'grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-2 text-sm',
              p.userId === currentUserId && 'bg-primary/5 ring-1 ring-primary/20',
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{p.displayName}</span>
              {p.userId === currentUserId && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">You</Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{p.predictedWinnerName}</span>
              {hasResult && (
                <span className="ml-1">
                  {p.correct ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <X className="size-3.5 text-muted-foreground/50" />
                  )}
                </span>
              )}
            </div>

            <div className="text-right">
              {hasResult ? (
                <span
                  className={cn(
                    'tabular-nums font-bold',
                    p.points > 0 ? 'text-emerald-400' : 'text-muted-foreground/60',
                  )}
                >
                  {p.points > 0 ? `+${p.points}` : '0'}
                </span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ScoringFooter rules={[`Correct winner: +${data.pointsPerWin} pts`]} />
    </div>
  )
}

function DoubleCheck() {
  return (
    <span className="inline-flex">
      <Check className="size-3.5 text-emerald-400" />
      <Check className="-ml-2 size-3.5 text-emerald-400" />
    </span>
  )
}

function ScoringFooter({ rules }: { rules: string[] }) {
  return (
    <div className="border-t border-border/40 pt-4 text-xs text-muted-foreground">
      <p className="mb-2 font-medium">Scoring</p>
      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
    </div>
  )
}
