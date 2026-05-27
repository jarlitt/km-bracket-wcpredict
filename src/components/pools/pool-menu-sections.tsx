'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PoolFlag } from '@/components/pools/pool-cards'
import { resolvePoolPredictionLandingPath } from '@/lib/pools/path'
import type { Pool } from '@/types'

interface PoolMenuSummary {
  submitted: boolean
  groupPredictionCount: number
  knockoutPredictionCount: number
}

export function PoolMenuSections({
  myPools,
  morePools,
  activePoolId,
  summariesByPoolId,
  onNavigate,
  onSelect,
}: {
  myPools: Pool[]
  morePools: Pool[]
  activePoolId?: string | null
  summariesByPoolId?: Map<string, PoolMenuSummary>
  onNavigate: () => void
  onSelect?: (slug: string) => void
}) {
  return (
    <div className="space-y-3">
      {myPools.length > 0 && (
        <PoolMenuGroup
          label="My pools"
          pools={myPools}
          emptyLabel=""
          activePoolId={activePoolId}
          summariesByPoolId={summariesByPoolId}
          onNavigate={onNavigate}
          onSelect={onSelect}
        />
      )}
      <PoolMenuGroup
        label={myPools.length > 0 ? 'More pools' : 'All pools'}
        pools={morePools}
        emptyLabel="No more pools"
        activePoolId={activePoolId}
        summariesByPoolId={summariesByPoolId}
        onNavigate={onNavigate}
        onSelect={onSelect}
      />
    </div>
  )
}

function PoolMenuGroup({
  label,
  pools,
  emptyLabel,
  activePoolId,
  summariesByPoolId,
  onNavigate,
  onSelect,
}: {
  label: string
  pools: Pool[]
  emptyLabel: string
  activePoolId?: string | null
  summariesByPoolId?: Map<string, PoolMenuSummary>
  onNavigate: () => void
  onSelect?: (slug: string) => void
}) {
  return (
    <div>
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {pools.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground/70">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-0.5">
          {pools.map((pool) => (
            <PoolMenuItem
              key={pool.id}
              pool={pool}
              active={pool.id === activePoolId}
              summary={summariesByPoolId?.get(pool.id)}
              onNavigate={onNavigate}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PoolMenuItem({
  pool,
  active,
  summary,
  onNavigate,
  onSelect,
}: {
  pool: Pool
  active: boolean
  summary?: PoolMenuSummary
  onNavigate: () => void
  onSelect?: (slug: string) => void
}) {
  const className = cn(
    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    active && 'bg-muted/50 text-foreground',
  )
  const inner = (
    <>
      <PoolFlag slug={pool.slug} size={22} />
      <span className="truncate">{pool.name}</span>
      {active && <Check className="ml-auto size-3.5" />}
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => {
          onSelect(pool.slug)
          onNavigate()
        }}
        className={className}
      >
        {inner}
      </button>
    )
  }

  const href = resolvePoolPredictionLandingPath(pool.slug, summary)

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={className}
    >
      {inner}
    </Link>
  )
}
