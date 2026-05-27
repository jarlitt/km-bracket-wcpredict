'use client'

import { useState } from 'react'
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
import { leavePool } from '@/app/actions/pools'
import { usePools } from '@/context/pool-context'
import { isTournamentLocked } from '@/lib/matches/lock'

export function LeavePoolButton() {
  const { activePool, memberships, refresh } = usePools()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const locked = isTournamentLocked()
  const isMember =
    !!activePool && memberships.some((membership) => membership.pool.id === activePool.id)

  if (!activePool || !isMember) return null

  const handleLeave = async () => {
    setBusy(true)
    const result = await leavePool(activePool.id)
    setBusy(false)

    if (!result.success) {
      toast.error(result.error ?? 'Failed to leave pool')
      return
    }

    await refresh()
    toast.success(`Left ${activePool.name}.`)
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={locked}
        className="text-xs"
        title={locked ? 'Pools are locked because the tournament has started' : undefined}
      >
        Leave pool
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {activePool.name}?</DialogTitle>
            <DialogDescription>
              Your predictions stay saved in case you rejoin later, but this
              pool will be removed from your joined pools.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleLeave()}
              disabled={busy}
            >
              {busy ? 'Leaving...' : 'Leave pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
