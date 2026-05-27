'use client'

import { Suspense, useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/auth/auth-modal'
import { BracketView } from '@/components/prediction/bracket-view'
import { usePredictions } from '@/context/predictions-context'
import { useAuth } from '@/context/auth-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import {
  applyKnockoutMatchups,
  matchupsFromKnockoutMatches,
  resolveKnockoutMatches,
} from '@/lib/bracket/resolve-bracket'
import {
  clearPendingSubmit,
  readPendingSubmit,
  writePendingSubmit,
} from '@/lib/predictions/pending-submit'
import { toast } from 'sonner'
import Link from 'next/link'

function BracketPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const basePath = '/predict'
  const wantsSubmit = searchParams.get('submit') === '1'
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(() =>
    readPendingSubmit(),
  )
  const {
    groupPredictions,
    knockoutPredictions,
    knockoutMatchups,
    tieBreakResolutions,
    setKnockoutPrediction,
    completedGroups,
    submitted,
    predictionsLocked,
    editingSubmission,
    submitting,
    submitPredictions,
    totalGroupPredictions,
    totalKnockoutPredictions,
    autofillKnockoutDemo,
    dbLoaded,
  } = usePredictions()

  const allStandings = useMemo(() => {
    const standings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      standings[group] = calculateGroupStandings(group, groupPredictions, { tieBreakResolutions })
    }
    return standings
  }, [groupPredictions, tieBreakResolutions])

  const { qualifiedGroups } = useMemo(
    () => determineBestThirdPlaceTeams(allStandings, { tieBreakResolutions }),
    [allStandings, tieBreakResolutions]
  )

  const knockoutMatches = useMemo(
    () => generateKnockoutBracket(allStandings, qualifiedGroups),
    [allStandings, qualifiedGroups]
  )

  const resolvedMatches = useMemo(
    () => resolveKnockoutMatches(knockoutMatches, knockoutPredictions),
    [knockoutMatches, knockoutPredictions],
  )

  const handlePickWinner = useCallback((matchId: string, winnerId: number) => {
    setKnockoutPrediction(matchId, winnerId)
  }, [setKnockoutPrediction])

  const allGroupsComplete = completedGroups.length === 12
  const allKnockoutComplete = totalKnockoutPredictions >= 32
  const readOnlySubmitted = submitted && !editingSubmission
  const canSubmit = allGroupsComplete && allKnockoutComplete && !submitted && !predictionsLocked && !submitting

  const displayedMatches = useMemo(() => {
    if (!readOnlySubmitted) return resolvedMatches
    return applyKnockoutMatchups(resolvedMatches, knockoutMatchups)
  }, [knockoutMatchups, readOnlySubmitted, resolvedMatches])

  const displayedMatchups = useMemo(
    () => matchupsFromKnockoutMatches(displayedMatches),
    [displayedMatches],
  )

  const handleSubmit = useCallback(async () => {
    if (submitted || predictionsLocked || submitting) return

    if (!allGroupsComplete) {
      toast.error(`Complete all group predictions first (${totalGroupPredictions}/72)`)
      return
    }

    if (!allKnockoutComplete) {
      toast.error(`Pick all knockout winners (${totalKnockoutPredictions}/32)`)
      return
    }

    if (!user) {
      writePendingSubmit()
      setPendingSubmitAfterAuth(true)
      setAuthOpen(true)
      return
    }

    const error = await submitPredictions(displayedMatchups)
    if (error) {
      toast.error(error)
      return
    }

    toast.success(
      submitted
        ? 'Predictions updated!'
        : 'Predictions submitted. You can edit them until kickoff.',
    )
    router.push(`${basePath}/summary`)
  }, [
    predictionsLocked,
    submitted,
    submitting,
    allGroupsComplete,
    allKnockoutComplete,
    totalGroupPredictions,
    totalKnockoutPredictions,
    user,
    basePath,
    router,
    submitPredictions,
    displayedMatchups,
  ])

  const attemptedRef = useRef(false)
  useEffect(() => {
    if (!wantsSubmit && !pendingSubmitAfterAuth) return
    if (attemptedRef.current) return
    if (authLoading || !user) return
    if (!dbLoaded) return
    if (predictionsLocked || submitting) return
    if (!allGroupsComplete || !allKnockoutComplete) return
    attemptedRef.current = true
    if (wantsSubmit) router.replace(`${basePath}/bracket`)
    void Promise.resolve().then(() => {
      clearPendingSubmit()
      setPendingSubmitAfterAuth(false)
      setAuthOpen(false)
      handleSubmit()
    })
  }, [
    wantsSubmit,
    pendingSubmitAfterAuth,
    authLoading,
    user,
    dbLoaded,
    submitted,
    predictionsLocked,
    submitting,
    allGroupsComplete,
    allKnockoutComplete,
    basePath,
    handleSubmit,
    router,
  ])

  if (!allGroupsComplete) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <p className="text-amber-300 mb-4">
            Complete all group predictions first to generate your bracket.
          </p>
          <Link href={`${basePath}/groups`}>
            <Button>Go to Group Predictions</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {submitted
            ? predictionsLocked
              ? 'Your predictions are locked. View your summary for details.'
              : 'Your predictions are submitted. You can edit and resubmit until kickoff.'
            : `Click on a team to pick the winner. Picks: ${totalKnockoutPredictions}/32`}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Link href={`${basePath}/thirds`}>
            <Button variant="outline" size="sm">Back to Best 3rds</Button>
          </Link>
          {submitted ? (
            <Link href={`${basePath}/summary`}>
              <Button size="sm">View Summary</Button>
            </Link>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
                className={canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 hover:bg-emerald-600/60'}
              >
                {submitting ? 'Submitting...' : 'Submit Predictions'}
              </Button>
              <button
                type="button"
                onClick={autofillKnockoutDemo}
                className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
              >
                <span className="dice-shake">🎲</span> Auto predict
              </button>
            </>
          )}
        </div>
      </div>

      <BracketView
        matches={displayedMatches}
        predictions={knockoutPredictions}
        onPickWinner={handlePickWinner}
        disabled={predictionsLocked || readOnlySubmitted}
      />

      <div className="flex gap-2 justify-between items-center">
        <Link href={`${basePath}/thirds`}>
          <Button variant="outline" size="sm">Back to Best 3rds</Button>
        </Link>
        {submitted ? (
          <Link href={`${basePath}/summary`}>
            <Button size="sm">View Summary</Button>
          </Link>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className={canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 hover:bg-emerald-600/60'}
          >
            {submitting ? 'Submitting...' : 'Submit Predictions'}
          </Button>
        )}
      </div>
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
        returnTo={`${basePath}/bracket`}
      />
    )}
    </>
  )
}

export default function BracketPage() {
  return (
    <Suspense fallback={null}>
      <BracketPageInner />
    </Suspense>
  )
}
