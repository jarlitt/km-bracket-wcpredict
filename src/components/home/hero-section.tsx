'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CountdownTimer } from '@/components/home/countdown-timer'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

interface HeroSectionProps {
  lockAt: string
  locked: boolean
}

export function HeroSection({ lockAt, locked }: HeroSectionProps) {
  const { user, loading: authLoading } = useAuth()
  const {
    submitted,
    groupPredictions,
    totalGroupPredictions,
    totalKnockoutPredictions,
    dbLoaded,
  } = usePredictions()

  const started = Object.keys(groupPredictions).length > 0
  const totalPredictions = totalGroupPredictions + totalKnockoutPredictions
  const totalMatches = TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES
  const overallProgress = Math.round((totalPredictions / totalMatches) * 100)

  let kicker: string
  let kickerColor = 'text-indigo-400'
  let headline: string
  let tagline: string

  if (locked) {
    kicker = 'TOURNAMENT IN PROGRESS'
    kickerColor = 'text-emerald-400'
    headline = 'The game is on.'
    tagline = 'Watch your predictions play out in real time.'
  } else if (authLoading || !dbLoaded) {
    kicker = 'FIFA WORLD CUP 2026'
    headline = 'Think you know football? Prove it.'
    tagline = '104 matches. One bracket. Zero excuses.'
  } else if (user && submitted) {
    kicker = 'FIFA WORLD CUP 2026'
    headline = "You're in. Now we wait."
    tagline = 'Predictions locked and loaded. Edit anytime before kickoff.'
  } else if (user && started) {
    kicker = 'FIFA WORLD CUP 2026'
    headline = "You've started. Now finish."
    tagline = "Don't leave your bracket half-done."
  } else {
    kicker = 'FIFA WORLD CUP 2026'
    headline = 'Think you know football? Prove it.'
    tagline = '104 matches. One bracket. Zero excuses.'
  }

  return (
    <section className="flex flex-col items-center text-center">
      <p className={`text-xs font-semibold uppercase tracking-widest ${kickerColor}`}>
        {kicker}
      </p>

      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          {headline}
        </span>
      </h1>

      <p className="mt-4 max-w-md text-base text-muted-foreground">{tagline}</p>

      {!locked && <div className="mt-6"><CountdownTimer lockAt={lockAt} /></div>}

      {locked && (
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Link
            href="/matches"
            className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
          >
            Live Scores
          </Link>
          <Link
            href="/leaderboard"
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}
          >
            View Leaderboard
          </Link>
        </div>
      )}

      {!locked && <HeroCtas
        authLoading={authLoading}
        dbLoaded={dbLoaded}
        user={user}
        submitted={submitted}
        started={started}
        overallProgress={overallProgress}
        totalPredictions={totalPredictions}
        totalMatches={totalMatches}
      />}
    </section>
  )
}

function HeroCtas({
  authLoading,
  dbLoaded,
  user,
  submitted,
  started,
  overallProgress,
  totalPredictions,
  totalMatches,
}: {
  authLoading: boolean
  dbLoaded: boolean
  user: { id: string } | null
  submitted: boolean
  started: boolean
  overallProgress: number
  totalPredictions: number
  totalMatches: number
}) {
  if (authLoading || !dbLoaded) {
    return (
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
          Start Predicting
        </Link>
        <Link href="/rules" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}>
          View Rules
        </Link>
      </div>
    )
  }

  if (user && submitted) {
    return (
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
          Edit Predictions
        </Link>
        <Link href="/leaderboard" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}>
          View Leaderboard
        </Link>
      </div>
    )
  }

  if (user && started) {
    return (
      <div className="mt-8 w-full max-w-sm space-y-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'w-full px-8 text-base' })}>
          Continue Predicting
        </Link>
        <div className="flex items-center gap-3">
          <Progress
            value={overallProgress}
            className="h-2 flex-1 [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <span className="whitespace-nowrap text-xs text-emerald-400">
            {totalPredictions}/{totalMatches}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
      <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
        Start Predicting
      </Link>
      <Link href="/rules" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}>
        View Rules
      </Link>
    </div>
  )
}
