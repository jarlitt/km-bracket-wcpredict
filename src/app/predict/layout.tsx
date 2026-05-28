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
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'
import { PredictProgressBar } from '@/components/prediction/predict-progress-bar'
import { shouldPromptForUnsavedChangesNavigation } from '@/lib/navigation/unsaved-changes-guard'
import { predictSummaryHref } from '@/lib/navigation/predict-routes'
import {
  clearPendingSubmit,
  readPendingSubmit,
  writePendingSubmit,
} from '@/lib/predictions/pending-submit'
import type { KnockoutMatchup } from '@/types'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

const STEPS = [
  { href: '/predict/groups', label: 'Groups' },
  { href: '/predict/thirds', label: 'Best 3rds' },
  { href: '/predict/bracket', label: 'Bracket' },
  { href: '/predict/summary', label: 'Summary' },
] as const

function isMatchupsEqual(
  a: Record<string, KnockoutMatchup>,
  b: Record<string, KnockoutMatchup>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key]
    const bv = b[key]
    if (!av || !bv) {
      if (av !== bv) return false
      continue
    }
    if (av.teamAId !== bv.teamAId || av.teamBId !== bv.teamBId) return false
  }
  return true
}

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
    isDirty,
    submitPredictions,
    discardUnsavedChanges,
    dbLoaded,
    submittedSnapshot,
    currentResolvedMatchups,
  } = usePredictions()
  const [submitting, setSubmitting] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(() =>
    readPendingSubmit(),
  )
  const [pendingNavigationHref, setPendingNavigationHref] = useState<
    string | null
  >(null)
  const attemptedAuthSubmitRef = useRef(false)
  const currentHrefRef = useRef<string | null>(null)
  const previousMatchupsRef = useRef<Record<string, KnockoutMatchup> | null>(
    null,
  )

  const allComplete =
    totalGroupPredictions >= TOTAL_GROUP_MATCHES &&
    totalKnockoutPredictions >= TOTAL_KNOCKOUT_MATCHES
  const summaryHref = predictSummaryHref()
  const hasSomethingToSubmit = isDirty || !submitted
  const submitButtonDisabled =
    submitting || !allComplete || !hasSomethingToSubmit
  const submitButtonLabel = submitted
    ? submitting
      ? 'Updating...'
      : 'Update submission'
    : submitting
      ? 'Submitting...'
      : 'Submit predictions'

  const handleSubmit = useCallback(async () => {
    if (!hasSomethingToSubmit) return
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

    const wasFirstSubmit = !submitted
    setSubmitting(true)
    const error = await submitPredictions()
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(
      wasFirstSubmit
        ? 'Predictions submitted. You can edit them until kickoff.'
        : 'Submission updated.',
    )
    router.push(summaryHref)
  }, [
    hasSomethingToSubmit,
    totalGroupPredictions,
    totalKnockoutPredictions,
    user,
    submitted,
    submitPredictions,
    router,
    summaryHref,
  ])

  const handleConfirmNavigation = () => {
    if (!pendingNavigationHref) return

    discardUnsavedChanges()

    const destinationHref = pendingNavigationHref
    setPendingNavigationHref(null)

    let destinationOrigin: string | null = null
    try {
      destinationOrigin = new URL(destinationHref).origin
    } catch {
      // fall through to assign
    }

    if (destinationOrigin === window.location.origin) {
      const url = new URL(destinationHref)
      router.push(`${url.pathname}${url.search}${url.hash}`)
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
    if (!allComplete) return

    attemptedAuthSubmitRef.current = true
    void Promise.resolve().then(() => {
      clearPendingSubmit()
      setPendingSubmitAfterAuth(false)
      setAuthOpen(false)
      handleSubmit()
    })
  }, [
    pendingSubmitAfterAuth,
    authLoading,
    user,
    dbLoaded,
    predictionsLocked,
    allComplete,
    handleSubmit,
  ])

  useEffect(() => {
    currentHrefRef.current = window.location.href
  }, [pathname])

  // Toast when a group/tie-break edit causes the resolved bracket to differ
  // from the user's last submission. We only fire after the snapshot is set
  // (i.e. the user has submitted at least once), and only when the matchups
  // actually changed since the previous render AND now differ from submitted.
  useEffect(() => {
    if (!submitted || !currentResolvedMatchups || !submittedSnapshot) return

    if (previousMatchupsRef.current === null) {
      previousMatchupsRef.current = currentResolvedMatchups
      return
    }

    const changedSinceLastRender = !isMatchupsEqual(
      currentResolvedMatchups,
      previousMatchupsRef.current,
    )
    if (changedSinceLastRender) {
      const differsFromSubmitted = !isMatchupsEqual(
        currentResolvedMatchups,
        submittedSnapshot.knockoutMatchups,
      )
      if (differsFromSubmitted) {
        toast.info('Your bracket changed based on your latest group predictions.')
      }
    }
    previousMatchupsRef.current = currentResolvedMatchups
  }, [currentResolvedMatchups, submitted, submittedSnapshot])

  useEffect(() => {
    if (!isDirty) return

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
        !shouldPromptForUnsavedChangesNavigation({
          hasUnsavedChanges: isDirty,
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
  }, [isDirty, pathname])

  useEffect(() => {
    if (!isDirty) return

    const handlePopState = () => {
      const destinationHref = window.location.href

      if (
        !shouldPromptForUnsavedChangesNavigation({
          hasUnsavedChanges: isDirty,
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
  }, [isDirty, pathname])

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const showSubmitInStrip = !submitted && !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked

  return (
    <div>
      <div
        id="predict-stepper"
        className="sticky top-14 z-40 border-b border-border/30 bg-background/95 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
          <nav
            aria-label="Predict navigation"
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide sm:shrink-0"
          >
            {STEPS.map((step) => {
              const isActive =
                pathname === step.href || pathname.startsWith(`${step.href}/`)
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-card text-foreground border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                  )}
                >
                  {step.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 sm:flex-1">
            <PredictProgressBar
              groupCount={totalGroupPredictions}
              knockoutCount={totalKnockoutPredictions}
              className="flex-1 min-w-0"
            />
            {showSubmitInStrip && (
              <Button
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={submitButtonDisabled}
                className={cn(
                  'shrink-0 bg-emerald-600 hover:bg-emerald-700',
                  submitButtonDisabled &&
                    'bg-emerald-600/40 hover:bg-emerald-600/40',
                )}
              >
                {submitButtonLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showDirtyBanner && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-amber-500/30 bg-amber-500/10"
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            <p className="flex-1 text-xs text-amber-300">
              You have unsaved changes since your last submission.
            </p>
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitButtonDisabled}
              className={cn(
                'shrink-0 bg-emerald-600 hover:bg-emerald-700',
                submitButtonDisabled &&
                  'bg-emerald-600/40 hover:bg-emerald-600/40',
              )}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </div>
      )}

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
          if (!open) {
            setPendingNavigationHref(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to your submitted predictions. If you
              leave now, your changes will be discarded and your saved
              submission will stay as it was.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingNavigationHref(null)}
            >
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
