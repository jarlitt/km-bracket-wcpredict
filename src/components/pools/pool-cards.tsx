'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { MyPoolSummary } from '@/app/actions/pools'
import { ArrowChip, PoolFlag } from '@/components/pools/pool-flag'

/**
 * Card for pools the user has already joined. Renders a progress bar when
 * predictions are still in progress and swaps the destination + badge once
 * the user has submitted.
 */
export function JoinedPoolCard({
  poolName,
  poolSlug,
  summary,
}: {
  poolName: string
  poolSlug: string
  summary?: MyPoolSummary
}) {
  const isSubmitted = summary?.submitted ?? false
  const groupCount = summary?.groupPredictionCount ?? 0
  const inProgress = !isSubmitted && groupCount > 0

  const badge = isSubmitted ? (
    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">
      Submitted
    </Badge>
  ) : inProgress ? (
    <Badge variant="secondary" className="text-[10px]">
      In progress
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">
      Not started
    </Badge>
  )

  const href = isSubmitted
    ? `/pools/${poolSlug}/predict/summary`
    : `/pools/${poolSlug}/predict/groups`

  return (
    <Link href={href} className="group block h-full">
      <Card className="flex min-h-[112px] h-full flex-col bg-card/50 border-border/50 transition-colors group-hover:bg-card/80">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <PoolFlag slug={poolSlug} />
            <CardTitle className="flex-1 truncate text-base">
              {poolName}
            </CardTitle>
            {badge}
            <ArrowChip />
          </div>
        </CardHeader>
        {!isSubmitted && summary && (
          <CardContent className="mt-auto pt-0">
            <div className="flex items-center gap-3 text-xs">
              <Progress
                value={Math.round((groupCount / 72) * 100)}
                className="flex-1 h-1.5"
              />
              <span className="text-muted-foreground whitespace-nowrap">
                {groupCount}/72 groups
              </span>
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

/**
 * Card for pools the viewer hasn't joined. Anonymous viewers and signed-in
 * non-members both see the same one-click target; the supplied `onAction`
 * decides whether that's "preview", "sign up & join", or "join".
 */
export function NotJoinedPoolCard({
  poolName,
  poolSlug,
  isBusy = false,
  ariaLabel,
  onAction,
}: {
  poolName: string
  poolSlug: string
  isBusy?: boolean
  ariaLabel?: string
  onAction?: () => void
}) {
  const inner = (
    <Card className="flex min-h-[112px] h-full flex-col justify-center bg-card/30 border-border/40 transition-colors group-hover:bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <PoolFlag slug={poolSlug} />
          <CardTitle className="flex-1 truncate text-base">
            {poolName}
          </CardTitle>
          <ArrowChip disabled={isBusy} />
        </div>
      </CardHeader>
    </Card>
  )

  if (onAction) {
    return (
      <button
        type="button"
        onClick={onAction}
        disabled={isBusy}
        className="group block h-full w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={ariaLabel ?? `Join ${poolName}`}
      >
        {inner}
      </button>
    )
  }
  return (
    <Link
      href={`/pools/${poolSlug}/predict/groups`}
      className="group block h-full"
      aria-label={ariaLabel ?? `Preview ${poolName}`}
    >
      {inner}
    </Link>
  )
}
