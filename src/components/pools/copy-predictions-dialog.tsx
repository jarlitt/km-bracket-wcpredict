'use client'

import { useMemo, useState } from 'react'
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
import { PoolFlag } from '@/components/pools/pool-cards'
import { usePools } from '@/context/pool-context'
import { usePredictions } from '@/context/predictions-context'
import { isTournamentLocked } from '@/lib/matches/lock'
import { cn } from '@/lib/utils'
import type { Pool } from '@/types'

type Step = 'select' | 'confirm'

export function CopyPredictionsDialog() {
  const { activePool, memberships, refresh } = usePools()
  const { copyPredictionsFromPool, editingSubmission, submitted } = usePredictions()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [sourcePool, setSourcePool] = useState<Pool | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = isTournamentLocked()

  const sourcePools = useMemo(
    () =>
      memberships
        .map((membership) => membership.pool)
        .filter((pool) => pool.id !== activePool?.id),
    [activePool?.id, memberships],
  )
  const selectablePools = useMemo(
    () => memberships.map((membership) => membership.pool),
    [memberships],
  )
  const isReadOnlySubmitted = submitted && !editingSubmission
  const canCopy = !!activePool && sourcePools.length > 0 && !locked

  const resetDialog = () => {
    setStep('select')
    setSourcePool(null)
    setBusy(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetDialog()
  }

  const handleCopy = async () => {
    if (!sourcePool) return
    setBusy(true)
    const error = await copyPredictionsFromPool(sourcePool.id)
    setBusy(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`Copied predictions from ${sourcePool.name}.`)
    setOpen(false)
    resetDialog()
    void refresh()
  }

  if (!activePool || sourcePools.length === 0 || isReadOnlySubmitted) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!canCopy}
        className="text-xs"
        title={locked ? 'Predictions are locked because the tournament has started' : undefined}
      >
        Copy predictions from submitted pool
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {step === 'select' ? 'Copy predictions from...' : 'Replace predictions?'}
            </DialogTitle>
            <DialogDescription>
              {step === 'select'
                ? `Choose the pool you want to copy into ${activePool.name}.`
                : `This will replace all predictions in ${activePool.name}.`}
            </DialogDescription>
          </DialogHeader>

          {step === 'select' ? (
            <div className="space-y-1">
              {selectablePools.map((pool) => {
                const isCurrent = pool.id === activePool.id
                return (
                  <button
                    key={pool.id}
                    type="button"
                    onClick={() => {
                      if (!isCurrent) setSourcePool(pool)
                    }}
                    disabled={isCurrent}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60',
                      sourcePool?.id === pool.id && 'border-primary/50 bg-primary/10',
                    )}
                  >
                    <PoolFlag slug={pool.slug} size={24} />
                    <span className="font-medium">{pool.name}</span>
                    {isCurrent && (
                      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Current pool
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p>
                You are about to replace all predictions in{' '}
                <strong>{activePool.name}</strong> with predictions from{' '}
                <strong>{sourcePool?.name}</strong>.
              </p>
              <p className="mt-2">
                This includes group scores and knockout picks. You can still edit
                them after copying until the first match starts.
              </p>
            </div>
          )}

          <DialogFooter>
            {step === 'confirm' && (
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                disabled={busy}
              >
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {step === 'select' ? (
              <Button
                onClick={() => setStep('confirm')}
                disabled={!sourcePool}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void handleCopy()}
                disabled={busy}
              >
                {busy ? 'Copying...' : 'Replace predictions'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
