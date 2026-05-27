'use client'

import { useMemo } from 'react'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { JoinedPoolCard, NotJoinedPoolCard } from '@/components/pools/pool-cards'

export function PoolsSection() {
  const { user, loading: authLoading } = useAuth()
  const { availablePools, userPool, loading: poolsLoading } = usePools()

  if (authLoading || poolsLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <p className="text-sm text-muted-foreground">Loading pools...</p>
      </section>
    )
  }

  const otherPools = availablePools.filter((p) => p.id !== userPool?.id)

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 space-y-10">
      {user && userPool && (
        <div className="space-y-3">
          <SectionHeader
            title="My pool"
            subtitle="Your office pool, based on your country."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <JoinedPoolCard
              poolName={userPool.name}
              poolSlug={userPool.slug}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader
          title={user ? 'Other pools' : 'All pools'}
          subtitle={
            user
              ? 'Browse pools from other offices.'
              : 'Preview any pool without an account. Sign up when you\u2019re ready to submit.'
          }
        />
        {otherPools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user
              ? 'No other pools available right now.'
              : 'No pools are open right now. Check back soon.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherPools.map((pool) => (
              <NotJoinedPoolCard
                key={pool.id}
                poolName={pool.name}
                poolSlug={pool.slug}
                ariaLabel={`Open ${pool.name}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
