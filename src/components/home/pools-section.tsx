'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import {
  getMyPoolSummaries,
  type MyPoolSummary,
} from '@/app/actions/pools'
import { JoinedPoolCard, NotJoinedPoolCard } from '@/components/pools/pool-cards'

export function PoolsSection() {
  const { user, loading: authLoading } = useAuth()
  const { availablePools, memberships, loading: poolsLoading } = usePools()

  const [summaries, setSummaries] = useState<MyPoolSummary[] | null>(null)
  const [summariesLoading, setSummariesLoading] = useState(false)

  // Per-pool summaries (rank, submitted, etc.) only make sense for signed-in
  // users — anon visitors just see the public list. All setState calls are
  // pushed into a microtask to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    if (!user) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setSummaries([])
        setSummariesLoading(false)
      })
      return () => {
        cancelled = true
      }
    }
    Promise.resolve().then(() => {
      if (cancelled) return
      setSummariesLoading(true)
      getMyPoolSummaries().then((data) => {
        if (cancelled) return
        setSummaries(data)
        setSummariesLoading(false)
      })
    })
    return () => {
      cancelled = true
    }
  }, [user, authLoading, memberships])

  const joinedPoolIds = useMemo(
    () => new Set(memberships.map((m) => m.pool.id)),
    [memberships],
  )

  if (authLoading || poolsLoading) {
    return (
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <p className="text-sm text-muted-foreground">Loading pools...</p>
      </section>
    )
  }

  const summariesById = new Map(
    (summaries ?? []).map((s) => [s.pool.id, s] as const),
  )

  const notJoinedPools = availablePools.filter((p) => !joinedPoolIds.has(p.id))

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 space-y-10">
      {user && (
        <div className="space-y-3">
          <SectionHeader
            title="My pools"
            subtitle={
              memberships.length === 0
                ? "You haven't joined any pools yet — jump into one below."
                : 'Quick access to the pools you’re playing in.'
            }
          />
          {summariesLoading && summaries === null ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t joined any pools yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memberships.map(({ pool }) => (
                <JoinedPoolCard
                  key={pool.id}
                  poolName={pool.name}
                  poolSlug={pool.slug}
                  summary={summariesById.get(pool.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader
          title={user ? 'Discover more pools' : 'All pools'}
          subtitle={
            user
              ? 'Browse pools you haven’t joined yet.'
              : 'Preview any pool without an account. Sign up when you’re ready to submit.'
          }
        />
        {notJoinedPools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user
              ? "You're in every open pool. Nothing left to discover."
              : 'No pools are open right now. Check back soon.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notJoinedPools.map((pool) => (
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
