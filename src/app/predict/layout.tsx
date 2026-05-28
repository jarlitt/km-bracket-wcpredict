'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

const STEPS = [
  { href: '/predict/groups', label: 'Groups' },
  { href: '/predict/bracket', label: 'Bracket' },
  { href: '/predict/summary', label: 'Summary' },
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
    isDirty,
    submitPredictions,
    discardUnsavedChanges,
    dbLoaded,
    submittedSnapshot,
    currentBracketEntryMatchups,
    knockoutPredictions,
  } = usePredictions()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
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

  // Derive which R32 matches have unresolved bracket conflicts: teams differ
  // from submitted snapshot AND the user hasn't re-picked a winner yet.
  // Fully reactive — clears per-match as the user picks, no manual dismiss.
  const unresolvedBracketConflicts = useMemo(() => {
    if (!submitted || !currentBracketEntryMatchups || !submittedSnapshot) {
      return 0
    }
    const submittedR32 = Object.fromEntries(
      Object.entries(submittedSnapshot.knockoutMatchups).filter(([k]) =>
        k.startsWith('R32-'),
      ),
    )
    let count = 0
    for (const [matchId, current] of Object.entries(currentBracketEntryMatchups)) {
      const baseline = submittedR32[matchId]
      if (!baseline) continue
      const teamsChanged =
        baseline.teamAId !== current.teamAId ||
        baseline.teamBId !== current.teamBId
      if (teamsChanged && !(matchId in knockoutPredictions)) {
        count++
      }
    }
    return count
  }, [submitted, currentBracketEntryMatchups, submittedSnapshot, knockoutPredictions])

  const bracketChanged = unresolvedBracketConflicts > 0

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

  const showSubmitInStrip = hasSomethingToSubmit && !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked

  return (
    <div>
      <div
        id="predict-stepper"
        className="sticky top-14 z-40 border-b border-border/30 bg-background/95 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 space-y-2">
          <nav
            aria-label="Predict navigation"
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
          >
            {STEPS.map((step) => {
              const isActive =
                pathname === step.href || pathname.startsWith(`${step.href}/`)
              const showBadge =
                step.href === '/predict/bracket' && bracketChanged
              return (
                <div key={step.href} className="relative">
                  <Link
                    href={step.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-card text-foreground border border-border/80 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/60',
                    )}
                  >
                    {step.label}
                    {showBadge && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black leading-none">
                        !
                      </span>
                    )}
                  </Link>
                  {showBadge && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 pointer-events-none">
                      <div className="relative bg-amber-500/90 text-black text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-amber-500/90 rotate-45" />
                        {unresolvedBracketConflicts === 1
                          ? '1 bracket match needs a new pick'
                          : `${unresolvedBracketConflicts} bracket matches need new picks`}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
          <div className="flex items-center gap-3">
            <PredictProgressBar
              groupCount={mounted ? totalGroupPredictions : 0}
              knockoutCount={mounted ? totalKnockoutPredictions : 0}
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {showDirtyBanner && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <p className="text-sm text-amber-300">
              You have unsaved changes.{' '}
              <button
                type="button"
                onClick={() => {
                  discardUnsavedChanges()
                  toast.info('Edits discarded.')
                }}
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                Discard
              </button>
            </p>
          </div>
        )}
        {children}
      </div>

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
