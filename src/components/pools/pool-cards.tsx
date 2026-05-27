'use client'

import Link from 'next/link'
import { ArrowRight, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { MyPoolSummary } from '@/app/actions/pools'

// Pool slug → flag filename in /public/country-flags/Countries. Office pools
// borrow their city's country flag; `all-offices` uses an "international"
// (globe-style) crest to read as the cross-office bracket.
const POOL_FLAG_BY_SLUG: Record<string, string> = {
  'all-offices': 'international.svg',
  spain: 'spain.svg',
  malta: 'malta.svg',
  nigeria: 'nigeria.svg',
  'south-africa': 'south-africa.svg',
  zambia: 'zambia.svg',
  uk: 'united-kingdom.svg',
}

export function PoolFlag({
  slug,
  size = 32,
  className,
}: {
  slug: string
  size?: number
  className?: string
}) {
  const file = POOL_FLAG_BY_SLUG[slug]
  if (!file) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Globe className="size-4" />
      </span>
    )
  }
  // The fixed-size wrapper guarantees consistent rendering even for SVGs that
  // rely on <pattern> fills (e.g. spain, united-kingdom), which sometimes
  // collapse the intrinsic size of a bare <img>.
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-card',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/country-flags/Countries/${file}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="block h-full w-full object-cover"
      />
    </span>
  )
}

export function ArrowChip({ disabled = false }: { disabled?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
        disabled
          ? 'border-border/30 bg-muted/40 text-muted-foreground/60'
          : 'border-border/40 bg-muted/40 text-muted-foreground group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary',
      )}
      aria-hidden="true"
    >
      <ArrowRight className="size-3.5" />
    </span>
  )
}

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
