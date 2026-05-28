'use client'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32
const GROUP_RATIO = TOTAL_GROUP_MATCHES / (TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES)
const KO_RATIO = TOTAL_KNOCKOUT_MATCHES / (TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES)

interface PredictProgressBarProps {
  groupCount: number
  knockoutCount: number
  className?: string
}

/**
 * Dual-segment progress bar that always shows where the user is across the
 * whole prediction flow. Widths are proportional to the segment totals
 * (72 vs. 32 picks), so a "full" left bar visually maps to "all groups done".
 *
 * Labels sit below each segment so the user can verify exact counts.
 */
export function PredictProgressBar({
  groupCount,
  knockoutCount,
  className,
}: PredictProgressBarProps) {
  const groupValue = Math.min(100, Math.round((groupCount / TOTAL_GROUP_MATCHES) * 100))
  const koValue = Math.min(100, Math.round((knockoutCount / TOTAL_KNOCKOUT_MATCHES) * 100))

  return (
    <div className={cn('flex w-full items-stretch gap-2', className)}>
      <div
        className="flex flex-col gap-1"
        style={{ flexBasis: `${GROUP_RATIO * 100}%` }}
      >
        <Progress
          value={groupValue}
          className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          {groupCount}/{TOTAL_GROUP_MATCHES}
        </span>
      </div>
      <div
        className="flex flex-col gap-1"
        style={{ flexBasis: `${KO_RATIO * 100}%` }}
      >
        <Progress
          value={koValue}
          className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          {knockoutCount}/{TOTAL_KNOCKOUT_MATCHES}
        </span>
      </div>
    </div>
  )
}
