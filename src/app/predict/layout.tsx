'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  } = usePredictions()
  const [submitting, setSubmitting] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(() =>
    readPendingSubmit(),
  )
  const [pendingNavigationHref, setPendingNavigationHref] = useState<
    string | null
  >(null)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const attemptedAuthSubmitRef = useRef(false)
  const currentHrefRef = useRef<string | null>(null)

  const allComplete =
    totalGroupPredictions >= TOTAL_GROUP_MATCHES &&
    totalKnockoutPredictions >= TOTAL_KNOCKOUT_MATCHES
  const summaryHref = predictSummaryHref()
  const hasSomethingToSubmit = isDirty || !submitted
  const submitButtonDisabled = submitting || !allComplete || !hasSomethingToSubmit
  const submitButtonLabel = submitted
    ? submitting ? 'Updating...' : 'Update submission'
    : submitting ? 'Submitting...' : 'Submit predictions'

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

    if (wasFirstSubmit) {
      toast.success('Predictions submitted. You can edit them until kickoff.')
      router.push(summaryHref)
    } else {
      toast.success('Submission updated.')
    }
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

  const handleDiscard = () => {
    setConfirmDiscardOpen(true)
  }

  const handleConfirmDiscard = () => {
    discardUnsavedChanges()
    setConfirmDiscardOpen(false)
    toast.info('Edits discarded.')
  }

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

  const showSubmit = !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked

  return (
    <div>
      <div
        id="predict-stepper"
        className="sticky top-14 z-40 border-b border-border/30 bg-background/95 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <PredictProgressBar
            groupCount={totalGroupPredictions}
            knockoutCount={totalKnockoutPredictions}
            className="flex-1"
          />
          {showSubmit && (
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitButtonDisabled}
              className={cn(
                'shrink-0 bg-emerald-600 hover:bg-emerald-700',
                submitButtonDisabled && 'bg-emerald-600/40 hover:bg-emerald-600/40',
              )}
            >
              {submitButtonLabel}
            </Button>
          )}
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
              You have unsaved changes since your last submission. Update
              your submission to save them.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              className="shrink-0 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
            >
              Discard changes
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
            <Button
              variant="destructive"
              onClick={handleConfirmNavigation}
            >
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              Your unsaved changes will be reverted to your last submitted
              predictions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDiscardOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Discard edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
