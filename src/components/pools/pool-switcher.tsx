'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PoolFlag } from '@/components/pools/pool-cards'
import { usePools } from '@/context/pool-context'
import { PoolMenuSections } from '@/components/pools/pool-menu-sections'
import Link from 'next/link'

interface Props {
  className?: string
}

export function PoolSwitcher({ className }: Props) {
  const {
    activePool,
    memberships,
    availablePools,
    myPoolSummaries,
  } = usePools()
  const [open, setOpen] = useState(false)

  const joinedPoolIds = useMemo(
    () => new Set(memberships.map((membership) => membership.pool.id)),
    [memberships],
  )
  const myPools = memberships.map((membership) => membership.pool)
  const morePools = availablePools.filter((pool) => !joinedPoolIds.has(pool.id))
  const summariesByPoolId = useMemo(
    () => new Map(myPoolSummaries.map((summary) => [summary.pool.id, summary])),
    [myPoolSummaries],
  )
  const isPreview = !!activePool && !joinedPoolIds.has(activePool.id)
  const hasPools = myPools.length > 0 || morePools.length > 0

  if (!hasPools) {
    return (
      <Link href="/pools">
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          Join a pool
        </Button>
      </Link>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          'h-auto max-w-full items-center justify-start gap-2 px-0 py-0 text-left hover:bg-transparent sm:gap-3',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {activePool && (
          <PoolFlag
            slug={activePool.slug}
            size={36}
            className="inline-flex sm:[width:40px] sm:[height:40px]"
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {activePool?.name ?? 'Select a pool'}
          </span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPreview ? 'Preview a pool' : 'Switch pool'}
            </DialogTitle>
            <DialogDescription>
              {isPreview
                ? 'Browse any pool. Sign up to submit your predictions and join a leaderboard.'
                : 'Predictions, submissions, and leaderboards are scoped to the selected pool.'}
            </DialogDescription>
          </DialogHeader>

          <PoolMenuSections
            myPools={myPools}
            morePools={morePools}
            activePoolId={activePool?.id}
            summariesByPoolId={summariesByPoolId}
            onNavigate={() => setOpen(false)}
          />

          <div className="pt-1 flex justify-end">
            <Link href="/pools" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm">
                {isPreview ? 'See all pools' : 'Manage pools'}
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
