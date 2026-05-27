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
import { isTournamentLocked } from '@/lib/matches/lock'
import {
  getMatchPredictions,
  type MatchPredictionsPayload,
} from '@/app/actions/match-predictions'
import type { LiveMatch } from '@/lib/espn/matches'
import type { Pool } from '@/types'
import { TeamFlag } from '@/components/team-flag'
import { PoolFlag } from '@/components/pools/pool-flag'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: LiveMatch
}

export function MatchPredictionsSheet({ open, onOpenChange, match }: Props) {
  const { user } = useAuth()
  const { userPool, availablePools } = usePools()
  const locked = isTournamentLocked()

  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)

  const selectedPool: Pool | null =
    (locked && selectedPoolId
      ? availablePools.find((p) => p.id === selectedPoolId) ?? null
      : null) ?? userPool

  useEffect(() => {
    if (open && userPool && !selectedPoolId) {
      setSelectedPoolId(userPool.id)
    }
  }, [open, userPool, selectedPoolId])

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
          {locked && availablePools.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {availablePools.map((pool) => (
                <button
                  key={pool.id}
                  type="button"
                  onClick={() => setSelectedPoolId(pool.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedPool?.id === pool.id
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  <PoolFlag slug={pool.slug} size={14} />
                  {pool.name.replace(' Office', '')}
                </button>
              ))}
            </div>
          )}

          {!match.internalId ? (
            <EmptyState>This match isn&apos;t tracked yet.</EmptyState>
          ) : !user ? (
            <EmptyState>
              Sign in to see predictions after the tournament starts.
            </EmptyState>
          ) : !selectedPool ? (
            <EmptyState>Join a pool to see predictions.</EmptyState>
          ) : loading ? (
            <EmptyState>Loading predictions...</EmptyState>
          ) : error ? (
            <EmptyState className="text-red-400">{error}</EmptyState>
          ) : !data || data.predictions.length === 0 ? (
            <EmptyState>
              {locked
                ? `No one in ${selectedPool.name} has predicted this match yet.`
                : "You\u2019ll see others\u2019 predictions once the tournament starts."}
            </EmptyState>
          ) : (
            <>
              {data.type === 'group' ? (
                <GroupPredictionsList data={data} currentUserId={user?.id} />
              ) : (
                <KnockoutPredictionsList data={data} currentUserId={user?.id} />
              )}
              {!locked && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  You&apos;ll see others&apos; predictions once the tournament starts.
                </p>
              )}
            </>
          )}
        </SheetBody>

        {data && data.predictions.length > 0 && (
          <ScoringFooter
            rules={
              data.type === 'group'
                ? ['Correct outcome (W/D/L): +3 pts', 'Exact scoreline: +2 pts bonus']
                : [`Correct winner: +${data.pointsPerWin} pts`]
            }
          />
        )}
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
    <div className="sticky bottom-0 border-t border-border/40 bg-background px-6 py-3 text-xs text-muted-foreground">
      <p className="mb-1 font-medium">Scoring</p>
      <ul className="space-y-0.5">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}
