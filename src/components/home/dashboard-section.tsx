'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

export function HeroCta() {
  const { user, loading: authLoading } = useAuth()
  const { submitted, groupPredictions, totalGroupPredictions, totalKnockoutPredictions, dbLoaded } = usePredictions()

  if (authLoading || !dbLoaded) {
    return (
      <div className="mt-10 flex gap-4">
        <Link
          href="/predict/groups"
          className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
        >
          Start Predicting
        </Link>
        <Link
          href="/rules"
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}
        >
          View Rules
        </Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mt-10 flex gap-4">
        <Link
          href="/predict/groups"
          className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
        >
          Start Predicting
        </Link>
        <Link
          href="/rules"
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}
        >
          View Rules
        </Link>
      </div>
    )
  }

  const started = Object.keys(groupPredictions).length > 0
  const totalPredictions = totalGroupPredictions + totalKnockoutPredictions
  const totalMatches = TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES
  const overallProgress = Math.round((totalPredictions / totalMatches) * 100)

  if (submitted) {
    return (
      <div className="mt-10 space-y-4">
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/leaderboard"
            className={buttonVariants({ size: 'lg', className: 'px-6 text-base' })}
          >
            View Leaderboard
          </Link>
          <Link
            href={`/pools/${user.country}`}
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-6 text-base' })}
          >
            My Office
          </Link>
        </div>
      </div>
    )
  }

  if (started) {
    return (
      <div className="mt-10 w-full max-w-sm space-y-4">
        <Link
          href="/predict/groups"
          className={buttonVariants({ size: 'lg', className: 'w-full px-8 text-base' })}
        >
          Continue Predicting
        </Link>
        <div className="flex items-center gap-3">
          <Progress
            value={overallProgress}
            className="flex-1 h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <span className="text-xs text-emerald-400 whitespace-nowrap">
            {totalPredictions}/{totalMatches}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-10 flex gap-4">
      <Link
        href="/predict/groups"
        className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
      >
        Start Predicting
      </Link>
      <Link
        href="/rules"
        className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}
      >
        View Rules
      </Link>
    </div>
  )
}
