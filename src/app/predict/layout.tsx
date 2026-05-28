'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'
import { shouldPromptForEditNavigation } from '@/lib/navigation/edit-mode-guard'
import { predictSummaryHref } from '@/lib/navigation/predict-routes'
import {
  clearPendingSubmit,
  readPendingSubmit,
  writePendingSubmit,
} from '@/lib/predictions/pending-submit'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

const STEP_DEFS = [
  { suffix: '/predict/groups', label: 'Group Matches', step: 1 },
  { suffix: '/predict/thirds', label: 'Best 3rds', step: 2 },
  { suffix: '/predict/bracket', label: 'Knockout Bracket', step: 3 },
  { suffix: '/predict/summary', label: 'Summary', step: 4 },
] as const

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const {
    totalGroupPredictions,
    totalKnockoutPredictions,
    submitted,
    predictionsLocked,
    editingSubmission,
    submitPredictions,
    startEditingSubmission,
    cancelEditingSubmission,
    dbLoaded,
  } = usePredictions()
  const [updating, setUpdating] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(() =>
    readPendingSubmit(),
  )
  const [pendingNavigationHref, setPendingNavigationHref] = useState<
    string | null
  >(null)
  const [discardingNavigation, setDiscardingNavigation] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const attemptedAuthSubmitRef = useRef(false)
  const currentHrefRef = useRef<string | null>(null)
  const groupProgress = Math.round(
    (totalGroupPredictions / TOTAL_GROUP_MATCHES) * 100,
  )

  const steps = STEP_DEFS.map((s) => ({
    ...s,
    href: s.suffix,
  }))

  const groupsDone = totalGroupPredictions >= TOTAL_GROUP_MATCHES
  const bracketDone = totalKnockoutPredictions >= TOTAL_KNOCKOUT_MATCHES
  const summaryHref = predictSummaryHref()

  const isStepCompleted = (suffix: string): boolean => {
    if (submitted && !editingSubmission) return true
    if (suffix === '/predict/groups') return groupsDone
    if (suffix === '/predict/thirds') return groupsDone
    if (suffix === '/predict/bracket') return bracketDone
    if (suffix === '/predict/summary') return submitted && !editingSubmission
    return false
  }

  const handleUpdateSubmission = async () => {
    setUpdating(true)
    const error = await submitPredictions()
    setUpdating(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success('Submission updated.')
    router.push(summaryHref)
  }

  const handleSubmitFromBanner = useCallback(async () => {
    if (totalGroupPredictions < TOTAL_GROUP_MATCHES) {
      toast.error(
        `Complete all group predictions first (${totalGroupPredictions}/${TOTAL_GROUP_MATCHES})`,
      )
      return
    }
    if (totalKnockoutPredictions < TOTAL_KNOCKOUT_MATCHES) {
      toast.error(
        `Pick all knockout winners (${totalKnockoutPredictions}/${TOTAL_KNOCKOUT_MATCHES})`,
      )
      return
    }

    if (!user) {
      attemptedAuthSubmitRef.current = false
      writePendingSubmit()
      setPendingSubmitAfterAuth(true)
      setAuthOpen(true)
      return
    }

    setUpdating(true)
    const error = await submitPredictions()
    setUpdating(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success('Predictions submitted. You can edit them until kickoff.')
    router.push(summaryHref)
  }, [totalGroupPredictions, totalKnockoutPredictions, user, submitPredictions, router, summaryHref])

  const handleCancelEditing = () => {
    setConfirmCancelOpen(true)
  }

  const handleConfirmCancelEditing = async () => {
    setCancelling(true)
    const error = await cancelEditingSubmission()
    setCancelling(false)
    setConfirmCancelOpen(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.info('Edits discarded.')
  }

  const handleConfirmNavigation = async () => {
    if (!pendingNavigationHref) return

    setDiscardingNavigation(true)
    const error = await cancelEditingSubmission()
    setDiscardingNavigation(false)

    if (error) {
      toast.error(error)
      return
    }

    const destinationHref = pendingNavigationHref
    setPendingNavigationHref(null)

    if (destinationHref.startsWith(window.location.origin)) {
      router.push(destinationHref.slice(window.location.origin.length))
      return
    }

    window.location.assign(destinationHref)
  }

  useEffect(() => {
    if (!pendingSubmitAfterAuth) return
    if (attemptedAuthSubmitRef.current) return
    if (authLoading || !user) return
    if (!dbLoaded) return
    if (predictionsLocked) return
    if (
      totalGroupPredictions < TOTAL_GROUP_MATCHES ||
      totalKnockoutPredictions < TOTAL_KNOCKOUT_MATCHES
    ) {
      return
    }

    attemptedAuthSubmitRef.current = true
    void Promise.resolve().then(() => {
      clearPendingSubmit()
      setPendingSubmitAfterAuth(false)
      setAuthOpen(false)
      handleSubmitFromBanner()
    })
  }, [
    pendingSubmitAfterAuth,
    authLoading,
    user,
    dbLoaded,
    predictionsLocked,
    totalGroupPredictions,
    totalKnockoutPredictions,
    handleSubmitFromBanner,
  ])

  useEffect(() => {
    currentHrefRef.current = window.location.href
  }, [pathname])

  useEffect(() => {
    if (!editingSubmission) return

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      if (!(event.target instanceof Element)) return

      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return

      const href = anchor.href
      if (
        !shouldPromptForEditNavigation({
          editingSubmission,
          currentPathname: pathname,
          destinationHref: href,
        })
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPendingNavigationHref(href)
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [editingSubmission, pathname])

  useEffect(() => {
    if (!editingSubmission) return

    const handlePopState = () => {
      const destinationHref = window.location.href

      if (
        !shouldPromptForEditNavigation({
          editingSubmission,
          currentPathname: pathname,
          destinationHref,
        })
      ) {
        currentHrefRef.current = destinationHref
        return
      }

      if (currentHrefRef.current) {
        window.history.pushState(null, '', currentHrefRef.current)
      }
      setPendingNavigationHref(destinationHref)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [editingSubmission, pathname])

  useEffect(() => {
    if (!editingSubmission) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [editingSubmission])

  return (
    <div>
      <div id="predict-stepper" className="static sm:sticky sm:top-14 z-40 border-b border-border/30 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 space-y-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {steps.map((step, i) => {
              const isActive = pathname.startsWith(step.href)
              const isCompleted = isStepCompleted(step.suffix)
              const nextCompleted =
                i < steps.length - 1
                  ? isStepCompleted(steps[i + 1].suffix)
                  : false
              return (
                <div
                  key={step.href}
                  className="flex items-center gap-1 sm:gap-2 flex-1"
                >
                  <Link
                    href={step.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap sm:px-2 sm:text-xs',
                      isActive && 'bg-muted/70 text-foreground',
                      !isActive && isCompleted && 'text-emerald-400',
                      !isActive &&
                        !isCompleted &&
                        'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold sm:size-5 sm:text-[10px]',
                        isActive &&
                          !isCompleted &&
                          'bg-foreground/10 text-foreground',
                        isActive &&
                          isCompleted &&
                          'bg-emerald-500/15 text-emerald-400',
                        !isActive &&
                          isCompleted &&
                          'bg-emerald-500/15 text-emerald-400',
                        !isActive &&
                          !isCompleted &&
                          'bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {isCompleted ? '✓' : step.step}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </Link>
                  {i < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-px opacity-60',
                        isCompleted && nextCompleted
                          ? 'bg-emerald-500/50'
                          : 'bg-border',
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {pathname.endsWith('/predict/groups') && (
            <div className="mt-2 flex items-center gap-3">
              <Progress value={groupProgress} className="flex-1 h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500" />
              <span className="text-xs text-emerald-400 whitespace-nowrap">
                {totalGroupPredictions}/{TOTAL_GROUP_MATCHES} matches
              </span>
            </div>
          )}
          {!predictionsLocked && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-lg border p-2',
                editingSubmission
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : submitted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-border/40 bg-card/30',
              )}
            >
              <div className="mr-auto space-y-0.5">
                <p
                  className={cn(
                  'text-xs',
                  editingSubmission
                      ? 'text-amber-300'
                      : submitted
                        ? 'text-emerald-300'
                        : 'text-muted-foreground',
                  )}
                >
                  {submitted
                    ? editingSubmission
                      ? 'Editing submitted predictions. Update or cancel before leaving.'
                      : 'Submitted. You can edit until kickoff.'
                    : `Groups ${totalGroupPredictions}/${TOTAL_GROUP_MATCHES} · Knockout ${totalKnockoutPredictions}/${TOTAL_KNOCKOUT_MATCHES}`}
                </p>
              </div>
              {!submitted ? (
                <Button
                  size="sm"
                  onClick={() => void handleSubmitFromBanner()}
                  disabled={updating}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {updating ? 'Submitting...' : 'Submit predictions'}
                </Button>
              ) : editingSubmission ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => void handleUpdateSubmission()}
                    disabled={updating || cancelling}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updating ? 'Updating...' : 'Update submission'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCancelEditing()}
                    disabled={updating || cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditingSubmission}
                >
                  Edit predictions
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      {authOpen && (
        <AuthModal
          open={authOpen}
          onOpenChange={(open) => {
            setAuthOpen(open)
            if (!open && !user) {
              clearPendingSubmit()
              setPendingSubmitAfterAuth(false)
            }
          }}
          initialMode="signup"
          returnTo="/predict/bracket"
        />
      )}
      <Dialog
        open={pendingNavigationHref !== null}
        onOpenChange={(open) => {
          if (!open && !discardingNavigation) {
            setPendingNavigationHref(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              You are editing submitted predictions. If you leave now, your
              changes will be discarded and your saved submission will stay as
              it was.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingNavigationHref(null)}
              disabled={discardingNavigation}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmNavigation()}
              disabled={discardingNavigation}
            >
              {discardingNavigation ? 'Discarding...' : 'Discard and leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmCancelOpen}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setConfirmCancelOpen(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              Your changes will be discarded and your saved submission will stay
              as it was.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCancelOpen(false)}
              disabled={cancelling}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmCancelEditing()}
              disabled={cancelling}
            >
              {cancelling ? 'Discarding...' : 'Discard edits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
