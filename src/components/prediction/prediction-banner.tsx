'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePredictions } from '@/context/predictions-context'
import { Progress } from '@/components/ui/progress'

export function PredictionBanner() {
  const { totalGroupPredictions, totalKnockoutPredictions, submitted, completedGroups } = usePredictions()

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-300">Predictions submitted</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">Your predictions are locked in. Good luck!</p>
          </div>
          <Link href="/predict/review">
            <Button variant="outline" size="sm" className="shrink-0">View Predictions</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (totalGroupPredictions === 0 && totalKnockoutPredictions === 0) return null

  const totalProgress = totalGroupPredictions + totalKnockoutPredictions
  const totalNeeded = 72 + 32
  const percent = Math.round((totalProgress / totalNeeded) * 100)

  const allGroupsDone = completedGroups.length === 12
  const allKnockoutDone = totalKnockoutPredictions >= 32

  let nextStep: { label: string; href: string }
  if (!allGroupsDone) {
    nextStep = { label: 'Continue Group Predictions', href: '/predict/groups' }
  } else if (!allKnockoutDone) {
    nextStep = { label: 'Fill Knockout Bracket', href: '/predict/bracket' }
  } else {
    nextStep = { label: 'Review & Submit', href: '/predict/review' }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Predictions in progress</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Groups: {totalGroupPredictions}/72 &middot; Knockout: {totalKnockoutPredictions}/32
            </p>
          </div>
          <Link href={nextStep.href}>
            <Button size="sm" className="shrink-0">{nextStep.label}</Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={percent} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{percent}%</span>
        </div>
      </div>
    </div>
  )
}
