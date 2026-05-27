'use client'

import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function PredictPickerPage() {
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

  if (userPool) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Predictions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your predictions for {userPool.name}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/pools/${userPool.slug}/predict/groups`}
            className="block"
          >
            <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {userPool.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Open your predictions
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-bold">My Predictions</h1>
      <p className="text-sm text-muted-foreground">
        No pool is assigned to your country yet. Browse the available pools.
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
