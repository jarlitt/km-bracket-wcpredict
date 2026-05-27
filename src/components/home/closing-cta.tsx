'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

export function ClosingCta({ locked }: { locked: boolean }) {
  const { user } = useAuth()
  const {
    submitted,
    groupPredictions,
    totalGroupPredictions,
    totalKnockoutPredictions,
  } = usePredictions()

  if (locked || submitted) return null

  const started = Object.keys(groupPredictions).length > 0
  const totalPredictions = totalGroupPredictions + totalKnockoutPredictions
  const totalMatches = TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES
  const pct = Math.round((totalPredictions / totalMatches) * 100)

  return (
    <section className="flex flex-col items-center rounded-xl border border-border/40 bg-card/30 px-6 py-12 text-center">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {started ? `${pct}% isn't gonna cut it.` : 'Still on the bench?'}
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {started
          ? 'Complete your predictions before kickoff.'
          : "Predictions lock at kickoff. Don't be that person."}
      </p>
      <div className="mt-6">
        <Link
          href="/predict/groups"
          className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
        >
          {started ? 'Continue Predicting' : 'Start Predicting'}
        </Link>
      </div>
    </section>
  )
}
