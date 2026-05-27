'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowChip, PoolFlag } from '@/components/pools/pool-flag'

export function JoinedPoolCard({
  poolName,
  poolSlug,
}: {
  poolName: string
  poolSlug: string
}) {
  const href = `/pools/${poolSlug}/predict/groups`

  return (
    <Link href={href} className="group block h-full">
      <Card className="flex min-h-[112px] h-full flex-col bg-card/50 border-border/50 transition-colors group-hover:bg-card/80">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <PoolFlag slug={poolSlug} />
            <CardTitle className="flex-1 truncate text-base">
              {poolName}
            </CardTitle>
            <ArrowChip />
          </div>
        </CardHeader>
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
