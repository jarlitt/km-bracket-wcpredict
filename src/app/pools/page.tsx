'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import {
  getMyPoolSummaries,
  leavePool,
  type MyPoolSummary,
} from '@/app/actions/pools'
import type { Pool } from '@/types'
import {
  JoinedPoolCard,
  NotJoinedPoolCard,
} from '@/components/pools/pool-cards'
import { isTournamentLocked } from '@/lib/matches/lock'

export default function PoolsPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    availablePools,
    memberships,
    loading: poolsLoading,
    refresh,
  } = usePools()

  const [summaries, setSummaries] = useState<MyPoolSummary[] | null>(null)
  const [busyPoolId, setBusyPoolId] = useState<string | null>(null)
  const [leaveDialog, setLeaveDialog] = useState<{
    open: boolean
    pool: Pool | null
  }>({ open: false, pool: null })
  const poolsLocked = isTournamentLocked()

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    if (!user) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setSummaries([])
      })
      return () => {
        cancelled = true
      }
    }
    Promise.resolve().then(() => {
      if (cancelled) return
      getMyPoolSummaries().then((data) => {
        if (cancelled) return
        setSummaries(data)
      })
    })
    return () => {
      cancelled = true
    }
  }, [user, authLoading, memberships])

  const joinedPoolIds = useMemo(
    () => new Set((summaries ?? []).map((s) => s.pool.id)),
    [summaries],
  )

  const discoverPools = useMemo(
    () =>
      user && summaries === null
        ? []
        : availablePools.filter((pool) => !joinedPoolIds.has(pool.id)),
    [availablePools, joinedPoolIds, summaries, user],
  )

  const handleLeave = async (pool: Pool) => {
    setBusyPoolId(pool.id)
    const res = await leavePool(pool.id)
    setBusyPoolId(null)
    setLeaveDialog({ open: false, pool: null })
    if (!res.success) {
      toast.error(res.error ?? 'Failed to leave pool')
      return
    }
    toast.success(`Left ${pool.name}.`)
    await refresh()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick which office competitions you want to play in. Open any pool to
          preview it — you&apos;ll join automatically once you start making
          predictions.
        </p>
      </div>

      {poolsLoading && availablePools.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading pools...</div>
      ) : null}

      {user && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            My pools
          </h2>
          {summaries === null ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t joined any pools yet. Open one below and start a
              prediction to join automatically.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summaries.map((summary) => (
                <div key={summary.pool.id} className="space-y-1">
                  <JoinedPoolCard
                    poolName={summary.pool.name}
                    poolSlug={summary.pool.slug}
                    summary={summary}
                  />
                  {!poolsLocked && (
                    <div className="flex justify-end px-1">
                      <button
                        type="button"
                        onClick={() =>
                          setLeaveDialog({ open: true, pool: summary.pool })
                        }
                        disabled={busyPoolId === summary.pool.id}
                        className="text-[11px] text-muted-foreground/70 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        Leave pool
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {user ? 'Discover more pools' : 'All pools'}
        </h2>
        {user && summaries === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : discoverPools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user
              ? "You're in every open pool. Nothing left to discover."
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

      <LeaveDialog
        state={leaveDialog}
        onCancel={() => setLeaveDialog({ open: false, pool: null })}
        onConfirm={() => {
          if (leaveDialog.pool) void handleLeave(leaveDialog.pool)
        }}
        busy={!!busyPoolId}
      />
    </div>
  )
}

function LeaveDialog({
  state,
  onCancel,
  onConfirm,
  busy,
}: {
  state: { open: boolean; pool: Pool | null }
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {state.pool?.name}?</DialogTitle>
          <DialogDescription>
            Your predictions for this pool stay saved in case you rejoin
            later, but you&apos;ll be removed from its leaderboard until then.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Leaving...' : 'Leave pool'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
