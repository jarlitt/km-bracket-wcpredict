'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  getMyPoolSummaries,
  type MyPoolSummary,
} from '@/app/actions/pools'

export default function PredictPickerPage() {
  const { user, loading: authLoading } = useAuth()
  const { availablePools, loading: poolsLoading } = usePools()
  const [summaries, setSummaries] = useState<MyPoolSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (authLoading) return
    if (!user) {
      // Anonymous browsers don't have memberships; the picker renders from
      // the public availablePools list instead.
      Promise.resolve().then(() => {
        if (cancelled) return
        setSummaries([])
      })
      return () => {
        cancelled = true
      }
    }
    getMyPoolSummaries().then((data) => {
      if (cancelled) return
      setSummaries(data)
    })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  if (authLoading || poolsLoading || summaries === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  // Anonymous: show every active pool as a "preview" entry. We can't
  // surface submission status without an account, but the pool is fully
  // playable until submit.
  if (!user) {
    if (availablePools.length === 0) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          <h1 className="text-2xl font-bold">My Predictions</h1>
          <p className="text-sm text-muted-foreground">
            No pools are open right now. Check back soon.
          </p>
        </div>
      )
    }
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Predictions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a pool to start predicting. You can fill in your bracket
            without an account — we&apos;ll only ask you to sign up when you
            want to submit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availablePools.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.slug}/predict/groups`}
              className="block"
            >
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{pool.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Preview
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Start predicting without an account
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">My Predictions</h1>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t joined any pool yet. Pick one to start predicting.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {availablePools.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.slug}/predict/groups`}
              className="block"
            >
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{pool.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Predictions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which pool you want to predict in. Each pool keeps its own
          predictions and submit lock.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {summaries.map((s) => {
          const groupProgress = Math.round((s.groupPredictionCount / 72) * 100)
          return (
            <Link
              key={s.pool.id}
              href={
                s.submitted
                  ? `/pools/${s.pool.slug}/predict/summary`
                  : `/pools/${s.pool.slug}/predict/groups`
              }
              className="block"
            >
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{s.pool.name}</span>
                    {s.submitted ? (
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">
                        Submitted
                      </Badge>
                    ) : s.groupPredictionCount > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        In progress
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Not started
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center gap-3 text-xs">
                    <Progress value={groupProgress} className="flex-1 h-1.5" />
                    <span className="text-muted-foreground whitespace-nowrap">
                      {s.groupPredictionCount}/72 groups
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Knockout: {s.knockoutPredictionCount}/32</span>
                    <span>{s.memberCount} members</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="pt-2">
        <Link
          href="/pools"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Manage pools
        </Link>
      </div>
    </div>
  )
}
