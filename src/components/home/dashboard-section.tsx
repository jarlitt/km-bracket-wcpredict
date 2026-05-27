'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

export function DashboardSection() {
  const { user, loading: authLoading } = useAuth()
  const { submitted, groupPredictions, dbLoaded } = usePredictions()

  if (authLoading || !dbLoaded) return null
  if (!user) return null

  const started = Object.keys(groupPredictions).length > 0

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.displayName}</span>
        </p>
        {submitted ? (
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/leaderboard"
              className={buttonVariants({ size: 'lg', className: 'px-6' })}
            >
              View Leaderboard
            </Link>
            <Link
              href={`/pools/${user.country}`}
              className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-6' })}
            >
              My Office
            </Link>
          </div>
        ) : started ? (
          <Link
            href="/predict/groups"
            className={buttonVariants({ size: 'lg', className: 'px-8' })}
          >
            Continue Your Bracket
          </Link>
        ) : (
          <Link
            href="/predict/groups"
            className={buttonVariants({ size: 'lg', className: 'px-8' })}
          >
            Make Your Bracket
          </Link>
        )}
      </div>
    </section>
  )
}
