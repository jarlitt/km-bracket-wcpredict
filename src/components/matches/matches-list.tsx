'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LiveMatch, MatchRound } from '@/lib/espn/matches'
import { MatchPredictionsSheet } from '@/components/matches/match-predictions-sheet'
import { TeamFlag } from '@/components/team-flag'

const ROUND_ORDER: Record<MatchRound, number> = {
  'group-stage': 0,
  'round-of-32': 1,
  'round-of-16': 2,
  quarterfinals: 3,
  semifinals: 4,
  '3rd-place-match': 5,
  final: 6,
}

const ROUND_FILTERS: Array<{ id: MatchRound; label: string }> = [
  { id: 'group-stage', label: 'Groups' },
  { id: 'round-of-32', label: 'R32' },
  { id: 'round-of-16', label: 'R16' },
  { id: 'quarterfinals', label: 'QF' },
  { id: 'semifinals', label: 'SF' },
  { id: '3rd-place-match', label: '3rd' },
  { id: 'final', label: 'Final' },
]

const TEN_MINUTES_MS = 10 * 60 * 1000

// We use a per-minute tick instead of calling Date.now() during render so the
// "is this match live?" check stays referentially stable inside useMemo, which
// makes the lint rule react-hooks/purity happy.
function subscribeMinute(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const id = window.setInterval(callback, 60 * 1000)
  return () => window.clearInterval(id)
}

function getMinuteSnapshot() {
  // Coarse-grained snapshot is fine for the 30-minute live window threshold.
  return Math.floor(Date.now() / 60_000)
}

function getServerMinuteSnapshot() {
  return 0
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function dateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

interface Props {
  matches: LiveMatch[]
  fetchedAt: string
}

export function MatchesList({ matches, fetchedAt }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<MatchRound>('group-stage')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // `hydrated` derives directly from useSyncExternalStore so we never have to
  // setState in an effect just to mark "client side".
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const minuteTick = useSyncExternalStore(
    subscribeMinute,
    getMinuteSnapshot,
    getServerMinuteSnapshot,
  )

  const hasLiveMatch = useMemo(
    () => {
      const now = minuteTick * 60_000
      return matches.some(
        (m) =>
          m.status.state === 'in' ||
          (m.status.state === 'pre' &&
            new Date(m.date).getTime() - now < 30 * 60 * 1000 &&
            new Date(m.date).getTime() > now),
      )
    },
    [matches, minuteTick],
  )

  useEffect(() => {
    if (!hasLiveMatch) return
    const interval = setInterval(() => {
      router.refresh()
    }, TEN_MINUTES_MS)
    return () => clearInterval(interval)
  }, [hasLiveMatch, router])

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const filtered = useMemo(
    () => matches.filter((m) => m.round === filter),
    [matches, filter],
  )

  const groupedByDate = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const t = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (t !== 0) return t
      return ROUND_ORDER[a.round] - ROUND_ORDER[b.round]
    })
    const groups: Record<string, LiveMatch[]> = {}
    for (const m of sorted) {
      const key = dateKey(m.date)
      groups[key] = groups[key] ?? []
      groups[key].push(m)
    }
    return groups
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ROUND_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span suppressHydrationWarning>
            {hydrated
              ? `Updated ${new Date(fetchedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-7 gap-1.5 px-2"
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {Object.entries(groupedByDate).map(([key, dayMatches]) => (
        <section key={key} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground" suppressHydrationWarning>
            {hydrated ? formatDateHeading(dayMatches[0].date) : key}
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {dayMatches.map((match) => (
              <MatchRow key={match.id} match={match} hydrated={hydrated} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-card/30 p-12 text-center text-sm text-muted-foreground">
          No matches in this round.
        </div>
      )}
    </div>
  )
}

function MatchRow({ match, hydrated }: { match: LiveMatch; hydrated: boolean }) {
  const [open, setOpen] = useState(false)
  const isLive = match.status.state === 'in'
  const isDone = match.status.state === 'post' && match.status.completed
  const hasStarted = isLive || isDone
  const hasPredictions = match.internalId !== null

  return (
    <>
      <Card className="border-border/40 bg-card/30 py-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs">
            <span className="text-muted-foreground" suppressHydrationWarning>
              {hydrated ? formatLocalTime(match.date) : '--:--'}
            </span>
            {isLive && (
              <Badge className="h-5 bg-red-500/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 hover:bg-red-500/15">
                <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-red-400" />
                Live
              </Badge>
            )}
            {isDone && (
              <Badge
                variant="secondary"
                className="h-5 bg-emerald-500/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 hover:bg-emerald-500/10"
              >
                FT
              </Badge>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <TeamLine team={match.home} highlighted={isDone && match.home.winner} />
            <TeamLine team={match.away} highlighted={isDone && match.away.winner} />
          </div>

          <div className="flex shrink-0 flex-col gap-1 text-sm font-bold tabular-nums">
            <ScoreBox score={match.home.score} winner={match.home.winner} hasStarted={hasStarted} isDone={isDone} />
            <ScoreBox score={match.away.score} winner={match.away.winner} hasStarted={hasStarted} isDone={isDone} />
          </div>
        </div>

        {hasPredictions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className="mt-2 h-7 w-full justify-between border border-primary/25 bg-primary/5 px-2 text-xs font-medium text-primary/90 hover:bg-primary/10 hover:text-primary"
          >
            See predictions
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </CardContent>
      </Card>

      {hasPredictions && (
        <MatchPredictionsSheet open={open} onOpenChange={setOpen} match={match} />
      )}
    </>
  )
}

function TeamLine({ team, highlighted }: { team: LiveMatch['home']; highlighted: boolean }) {
  const label = team.team?.name ?? team.name
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-0.5 text-sm',
        highlighted ? 'font-semibold' : 'font-normal',
        !team.team && 'text-muted-foreground',
      )}
    >
      <TeamFlag team={team.team} size={18} className="size-[18px]" />
      <span className="truncate">{label}</span>
    </div>
  )
}

function ScoreBox({
  score,
  winner,
  hasStarted,
  isDone,
}: {
  score: number | null
  winner: boolean
  hasStarted: boolean
  isDone: boolean
}) {
  const display = hasStarted && score !== null ? score : '-'
  return (
    <span
      className={cn(
        'flex h-7 w-8 items-center justify-center rounded border border-border/50 bg-background/40',
        !hasStarted && 'text-muted-foreground/60',
        isDone && !winner && 'text-muted-foreground/70',
      )}
    >
      {display}
    </span>
  )
}
