'use client'

import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPickerPage() {
  const { user, loading: authLoading } = useAuth()
  const { availablePools, userPool, loading: poolsLoading } = usePools()

  if (authLoading || poolsLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

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

  if (userPool) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pool Standings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leaderboard for {userPool.name}.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/pools/${userPool.slug}/dashboard`}
            className="block"
          >
            <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{userPool.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                View leaderboard
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="pt-2">
          <Link
            href="/pools"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All pools
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pool Standings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all pool leaderboards.
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
