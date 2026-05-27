'use client'

import { useMemo } from 'react'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import type { Pool } from '@/types'
import {
  JoinedPoolCard,
  NotJoinedPoolCard,
} from '@/components/pools/pool-cards'

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
            <JoinedPoolCard
              poolName={userPool.name}
              poolSlug={userPool.slug}
            />
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
              <NotJoinedPoolCard
                key={pool.id}
                poolName={pool.name}
                poolSlug={pool.slug}
                ariaLabel={`Open ${pool.name}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
