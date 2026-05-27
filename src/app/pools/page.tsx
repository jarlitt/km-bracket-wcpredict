'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowChip, PoolFlag } from '@/components/pools/pool-flag'

export default function PoolsPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    availablePools,
    userPool,
    loading: poolsLoading,
  } = usePools()

  const discoverPools = useMemo(
    () =>
      userPool
        ? availablePools.filter((pool) => pool.id !== userPool.id)
        : availablePools,
    [availablePools, userPool],
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your office pool is assigned based on your country. Browse all pools
          below.
        </p>
      </div>

      {poolsLoading && availablePools.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading pools...</div>
      ) : null}

      {user && userPool && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            My pool
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/predict/groups" className="group block h-full">
              <Card className="flex min-h-[112px] h-full flex-col bg-card/50 border-border/50 transition-colors group-hover:bg-card/80">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <PoolFlag slug={userPool.slug} />
                    <CardTitle className="flex-1 truncate text-base">
                      {userPool.name}
                    </CardTitle>
                    <ArrowChip />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {user ? 'Other pools' : 'All pools'}
        </h2>
        {discoverPools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user
              ? 'No other pools available right now.'
              : 'No pools are available right now.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discoverPools.map((pool) => (
              <Link
                key={pool.id}
                href="/predict/groups"
                className="group block h-full"
                aria-label={`Open ${pool.name}`}
              >
                <Card className="flex min-h-[112px] h-full flex-col justify-center bg-card/30 border-border/40 transition-colors group-hover:bg-card/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <PoolFlag slug={pool.slug} />
                      <CardTitle className="flex-1 truncate text-base">
                        {pool.name}
                      </CardTitle>
                      <ArrowChip />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
