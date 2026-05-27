'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getMyPoolSummaries,
  type MyPoolSummary,
} from '@/app/actions/pools'

export default function DashboardPickerPage() {
  const { user, loading: authLoading } = useAuth()
  const { availablePools, loading: poolsLoading } = usePools()
  const [summaries, setSummaries] = useState<MyPoolSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (authLoading) return
    if (!user) {
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

  // Anonymous: leaderboards are public — show all pools so visitors can
  // peek at any standings.
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pool Standings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse the leaderboard for any pool. Sign up to compete.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availablePools.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.slug}/dashboard`}
              className="block"
            >
              <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{pool.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  View leaderboard
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
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pool Standings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join a pool to compete, or peek at any leaderboard.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availablePools.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.slug}/dashboard`}
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
        <h1 className="text-2xl font-bold">Pool Standings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a pool to see the leaderboard for that group.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {summaries.map((s) => (
          <Link
            key={s.pool.id}
            href={`/pools/${s.pool.slug}/dashboard`}
            className="block"
          >
            <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{s.pool.name}</span>
                  {s.myRank !== null && (
                    <Badge className="text-[10px] bg-primary/20 text-primary">
                      #{s.myRank}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground flex items-center justify-between">
                <span>{s.memberCount} members</span>
                <span>
                  {s.myTotalScore !== null
                    ? `${s.myTotalScore} pts`
                    : s.submitted
                      ? 'Awaiting scores'
                      : 'Not submitted'}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
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
