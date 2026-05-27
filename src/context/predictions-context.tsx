'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { GROUPS, getTeamsByGroup } from '@/lib/data/teams'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import {
  matchupsFromKnockoutMatches,
  resolveKnockoutMatches,
} from '@/lib/bracket/resolve-bracket'
import { collectDependents, resetAffectedKnockoutPredictions } from '@/lib/bracket/reset-affected'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import { loadPredictions, submitPredictionsToDb } from '@/app/actions/predictions'
import {
  defaultPredictionsState,
  readPredictionsFromStorage,
  writePredictionsToStorage,
  type PredictionsState,
} from '@/lib/predictions/storage'
import { hasCompleteScore } from '@/lib/predictions/completeness'
// TODO: Task 14 — remove reconcilePredictionStateForMembership entirely
import { reconcilePredictionStateForMembership } from '@/lib/predictions/membership-state'
import { isTournamentLocked } from '@/lib/matches/lock'
import type { KnockoutMatchup } from '@/types'

const MATCHES_PER_GROUP = 6

interface PredictionsContextType extends PredictionsState {
  setGroupPrediction: (matchId: number, scoreA: number | undefined, scoreB: number | undefined) => void
  setKnockoutPrediction: (matchId: string, winnerId: number) => void
  setTieBreakResolution: (key: string, teamOrder: number[]) => void
  submitPredictions: (knockoutMatchups?: Record<string, KnockoutMatchup>) => Promise<string | null>
  startEditingSubmission: () => void
  cancelEditingSubmission: () => Promise<string | null>
  resetPredictions: () => void
  autofillDemo: () => void
  autofillAllOneZero: () => void
  autofillGroupDemo: (groupId: string) => void
  autofillKnockoutDemo: () => void
  completedGroups: string[]
  totalGroupPredictions: number
  totalKnockoutPredictions: number
  submitting: boolean
  dbLoaded: boolean
  hasActivePool: boolean
  predictionsLocked: boolean
  editingSubmission: boolean
}

const PredictionsContext = createContext<PredictionsContextType | null>(null)

function loadFromStorage(
  userId: string | null,
  poolId: string | null,
): PredictionsState {
  if (!poolId) return defaultPredictionsState
  if (typeof window === 'undefined') return defaultPredictionsState
  return readPredictionsFromStorage(window.localStorage, userId, poolId)
}

function saveToStorage(
  userId: string | null,
  poolId: string,
  state: PredictionsState,
) {
  if (typeof window === 'undefined') return
  writePredictionsToStorage(window.localStorage, userId, poolId, state)
}

/**
 * Renders a fresh PredictionsProvider whenever the active (user, pool) pair
 * changes. The `key` remount means we never need a useEffect to reset state
 * inside the provider itself — React tears down and re-creates the subtree.
 */
export function PredictionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { userPool, refresh } = usePools()
  const userId = user?.id ?? null
  const poolId = userPool?.id ?? null
  const poolName = userPool?.name ?? null
  const isMember = !!poolId && !!user

  return (
    <ScopedPredictionsProvider
      key={`${userId ?? 'anon'}:${poolId ?? 'none'}`}
      userId={userId}
      poolId={poolId}
      poolName={poolName}
      isMember={isMember}
      onAutoJoined={refresh}
    >
      {children}
    </ScopedPredictionsProvider>
  )
}

interface ScopedProps {
  userId: string | null
  poolId: string | null
  poolName: string | null
  isMember: boolean
  onAutoJoined: () => Promise<void>
  children: ReactNode
}

function ScopedPredictionsProvider({
  userId,
  poolId,
  poolName,
  isMember,
  onAutoJoined,
  children,
}: ScopedProps) {
  // Seed from localStorage lazily so we don't need an effect to do it.
  const [state, setState] = useState<PredictionsState>(() =>
    loadFromStorage(userId, poolId),
  )
  const [submitting, setSubmitting] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [editingSubmission, setEditingSubmission] = useState(false)
  const [membershipRefreshPending, setMembershipRefreshPending] = useState(false)

  // Hydrate from DB. All setStates live inside the .then() callback so the
  // synchronous body of the effect never touches state.
  useEffect(() => {
    if (!userId || !poolId) {
      return
    }
    let cancelled = false
    loadPredictions(poolId).then((dbData) => {
      if (cancelled) return
      if (!dbData) {
        // User is not a member — clear any stale localStorage state so the UI
        // doesn't incorrectly show them as submitted/registered.
        if (!isMember) {
          setState(defaultPredictionsState)
        }
        setDbLoaded(true)
        return
      }
      setState((prev) => ({
        groupPredictions:
          Object.keys(dbData.groupPredictions).length > 0
            ? dbData.groupPredictions
            : prev.groupPredictions,
        knockoutPredictions:
          Object.keys(dbData.knockoutPredictions).length > 0
            ? dbData.knockoutPredictions
            : prev.knockoutPredictions,
        knockoutMatchups:
          Object.keys(dbData.knockoutMatchups).length > 0
            ? dbData.knockoutMatchups
            : prev.knockoutMatchups,
        tieBreakResolutions: dbData.tieBreakResolutions,
        submitted: dbData.submitted,
      }))
      setDbLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId, poolId, isMember])

  // Persist drafts to localStorage. Anonymous users save under the
  // 'anon' scope so their picks carry over on signup (see loadFromStorage).
  useEffect(() => {
    if (editingSubmission && state.submitted) return
    if (poolId) saveToStorage(userId, poolId, state)
  }, [state, userId, poolId, editingSubmission])

  useEffect(() => {
    if (isMember) {
      if (membershipRefreshPending) {
        void Promise.resolve().then(() => setMembershipRefreshPending(false))
      }
      return
    }
    if (!state.submitted) return

    void Promise.resolve().then(() => {
      setEditingSubmission(false)
      setState((prev) =>
        reconcilePredictionStateForMembership(prev, false, {
          membershipRefreshPending,
        }),
      )
    })
  }, [isMember, membershipRefreshPending, state.submitted])

  // In the country-based model, auto-join is no longer needed — users are
  // implicitly in their country pool. This is a no-op kept so callers that
  // trigger it on first edit don't need to be rewritten yet.
  const tryAutoJoin = useCallback(() => {}, [])

  const buildKnockoutMatchesForState = useCallback((snapshot: PredictionsState) => {
    const allStandings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      allStandings[group] = calculateGroupStandings(group, snapshot.groupPredictions, {
        tieBreakResolutions: snapshot.tieBreakResolutions,
      })
    }

    const { qualifiedGroups } = determineBestThirdPlaceTeams(allStandings, {
      tieBreakResolutions: snapshot.tieBreakResolutions,
    })
    return generateKnockoutBracket(allStandings, qualifiedGroups)
  }, [])

  const setGroupPrediction = useCallback(
    (matchId: number, scoreA: number | undefined, scoreB: number | undefined) => {
      setState((prev) => {
        const nextGroupPredictions = { ...prev.groupPredictions }
        if (scoreA === undefined && scoreB === undefined) {
          delete nextGroupPredictions[matchId]
        } else {
          nextGroupPredictions[matchId] = { scoreA, scoreB }
        }

        const nextState = { ...prev, groupPredictions: nextGroupPredictions }

        // Only run bracket comparison when all groups were previously complete
        // (otherwise the bracket page isn't even visible).
        const hadAllGroups =
          Object.values(prev.groupPredictions).filter((p) => hasCompleteScore(p.scoreA, p.scoreB)).length >= 72

        if (hadAllGroups && Object.keys(prev.knockoutPredictions).length > 0) {
          const previousMatches = buildKnockoutMatchesForState(prev)
          const nextMatches = buildKnockoutMatchesForState(nextState)
          const reset = resetAffectedKnockoutPredictions({
            previousMatches,
            nextMatches,
            predictions: prev.knockoutPredictions,
          })
          if (reset.resetMatchIds.size > 0) {
            return {
              ...nextState,
              knockoutPredictions: reset.predictions,
              knockoutMatchups: {},
            }
          }
        }

        return nextState
      })
      if (hasCompleteScore(scoreA, scoreB)) {
        tryAutoJoin()
      }
    },
    [tryAutoJoin, buildKnockoutMatchesForState],
  )

  const setKnockoutPrediction = useCallback(
    (matchId: string, winnerId: number) => {
      setState((prev) => {
        const previousWinner = prev.knockoutPredictions[matchId]

        // Same pick — no change needed.
        if (previousWinner === winnerId) return prev

        const nextPredictions = { ...prev.knockoutPredictions, [matchId]: winnerId }

        // If the winner changed, clear all downstream predictions that
        // depend on this match (they now have different participants).
        if (previousWinner !== undefined) {
          const downstream = collectDependents([matchId])
          downstream.delete(matchId) // keep the current pick
          for (const depId of downstream) {
            delete nextPredictions[depId]
          }
        }

        return {
          ...prev,
          knockoutPredictions: nextPredictions,
          knockoutMatchups: previousWinner !== undefined ? {} : prev.knockoutMatchups,
        }
      })
    },
    [],
  )

  const setTieBreakResolution = useCallback((key: string, teamOrder: number[]) => {
    setState((prev) => {
      const previousMatches = buildKnockoutMatchesForState(prev)
      const nextTieBreakResolutions = {
        ...prev.tieBreakResolutions,
        [key]: teamOrder,
      }
      const nextSnapshot = {
        ...prev,
        tieBreakResolutions: nextTieBreakResolutions,
      }
      const nextMatches = buildKnockoutMatchesForState(nextSnapshot)
      const reset = resetAffectedKnockoutPredictions({
        previousMatches,
        nextMatches,
        predictions: prev.knockoutPredictions,
      })

      return {
        ...nextSnapshot,
        knockoutPredictions: reset.predictions,
        knockoutMatchups: reset.resetMatchIds.size > 0 ? {} : prev.knockoutMatchups,
      }
    })
  }, [buildKnockoutMatchesForState])

  const buildCurrentKnockoutMatchups = useCallback((): Record<string, KnockoutMatchup> => {
    const generatedMatches = buildKnockoutMatchesForState(state)
    const resolvedMatches = resolveKnockoutMatches(generatedMatches, state.knockoutPredictions)
    return matchupsFromKnockoutMatches(resolvedMatches)
  }, [state, buildKnockoutMatchesForState])

  const submitPredictions = useCallback(async (
    knockoutMatchups?: Record<string, KnockoutMatchup>,
  ): Promise<string | null> => {
    if (!poolId) return 'No active pool'
    setSubmitting(true)
    try {
      const submittedMatchups = knockoutMatchups ?? buildCurrentKnockoutMatchups()
      const result = await submitPredictionsToDb(
        poolId,
        state.groupPredictions,
        state.knockoutPredictions,
        submittedMatchups,
      )
      if (!result.success) {
        return result.error ?? 'Failed to submit predictions'
      }
      setMembershipRefreshPending(true)
      await onAutoJoined()
      setState((prev) => ({ ...prev, knockoutMatchups: submittedMatchups, submitted: true }))
      setEditingSubmission(false)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [
    poolId,
    state.groupPredictions,
    state.knockoutPredictions,
    buildCurrentKnockoutMatchups,
    onAutoJoined,
  ])

  const startEditingSubmission = useCallback(() => {
    setEditingSubmission(true)
  }, [])

  const cancelEditingSubmission = useCallback(async (): Promise<string | null> => {
    if (!poolId) return 'No active pool'
    const dbData = await loadPredictions(poolId)
    if (!dbData) return 'Failed to reload saved predictions'

    setState({
      groupPredictions: dbData.groupPredictions,
      knockoutPredictions: dbData.knockoutPredictions,
      knockoutMatchups: dbData.knockoutMatchups,
      tieBreakResolutions: dbData.tieBreakResolutions,
      submitted: dbData.submitted,
    })
    setEditingSubmission(false)
    return null
  }, [poolId])

  const resetPredictions = useCallback(() => {
    setState(defaultPredictionsState)
  }, [])

  const autofillDemo = useCallback(() => {
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }

    const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}

    for (const match of GROUP_MATCHES) {
      const r = seededRandom(match.id * 7 + 13)
      const teamA = getTeamsByGroup(match.groupId)
      const aIdx = teamA.findIndex(t => t.id === match.teamAId)
      const bIdx = teamA.findIndex(t => t.id === match.teamBId)
      const aStrength = 3 - aIdx
      const bStrength = 3 - bIdx

      let scoreA: number, scoreB: number
      if (r < 0.45) {
        scoreA = Math.min(aStrength, 4)
        scoreB = Math.max(0, scoreA - 1 - Math.floor(r * 3))
      } else if (r < 0.7) {
        scoreA = Math.floor(r * 3)
        scoreB = scoreA
      } else {
        scoreB = Math.min(bStrength, 3)
        scoreA = Math.max(0, scoreB - 1 - Math.floor(r * 2))
      }

      groupPredictions[match.id] = { scoreA, scoreB }
    }

    setState(prev => ({ ...prev, groupPredictions, knockoutPredictions: {}, knockoutMatchups: {} }))
    tryAutoJoin()
  }, [tryAutoJoin])

  const autofillAllOneZero = useCallback(() => {
    const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}
    for (const match of GROUP_MATCHES) {
      groupPredictions[match.id] = { scoreA: 1, scoreB: 0 }
    }
    setState(prev => ({ ...prev, groupPredictions, knockoutPredictions: {}, knockoutMatchups: {} }))
    tryAutoJoin()
  }, [tryAutoJoin])

  const autofillGroupDemo = useCallback((groupId: string) => {
    const matches = GROUP_MATCHES.filter(m => m.groupId === groupId)
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }

    setState(prev => {
      const gp = { ...prev.groupPredictions }
      for (const match of matches) {
        const r = seededRandom(match.id * 7 + 13 + Date.now() % 1000)
        const teamA = getTeamsByGroup(match.groupId)
        const aIdx = teamA.findIndex(t => t.id === match.teamAId)
        const bIdx = teamA.findIndex(t => t.id === match.teamBId)
        const aStrength = 3 - aIdx
        const bStrength = 3 - bIdx

        let scoreA: number, scoreB: number
        if (r < 0.45) {
          scoreA = Math.min(aStrength, 4)
          scoreB = Math.max(0, scoreA - 1 - Math.floor(r * 3))
        } else if (r < 0.7) {
          scoreA = Math.floor(r * 3)
          scoreB = scoreA
        } else {
          scoreB = Math.min(bStrength, 3)
          scoreA = Math.max(0, scoreB - 1 - Math.floor(r * 2))
        }

        gp[match.id] = { scoreA, scoreB }
      }
      return { ...prev, groupPredictions: gp }
    })
    tryAutoJoin()
  }, [tryAutoJoin])

  const autofillKnockoutDemo = useCallback(() => {
    const gp = state.groupPredictions
    if (Object.keys(gp).length < 72) return

    const allStandings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      allStandings[group] = calculateGroupStandings(group, gp, {
        tieBreakResolutions: state.tieBreakResolutions,
      })
    }
    const { qualifiedGroups } = determineBestThirdPlaceTeams(allStandings, {
      tieBreakResolutions: state.tieBreakResolutions,
    })
    const matches = generateKnockoutBracket(allStandings, qualifiedGroups)

    const matchMap = new Map(matches.map(m => [m.id, m]))
    const picks: Record<string, number> = {}

    const bracketTree: Record<string, { a: string; b: string; loser?: boolean }> = {
      'R16-1': { a: 'R32-1', b: 'R32-2' },
      'R16-2': { a: 'R32-3', b: 'R32-4' },
      'R16-3': { a: 'R32-5', b: 'R32-6' },
      'R16-4': { a: 'R32-7', b: 'R32-8' },
      'R16-5': { a: 'R32-9', b: 'R32-10' },
      'R16-6': { a: 'R32-11', b: 'R32-12' },
      'R16-7': { a: 'R32-13', b: 'R32-14' },
      'R16-8': { a: 'R32-15', b: 'R32-16' },
      'QF-1': { a: 'R16-1', b: 'R16-2' },
      'QF-2': { a: 'R16-3', b: 'R16-4' },
      'QF-3': { a: 'R16-5', b: 'R16-6' },
      'QF-4': { a: 'R16-7', b: 'R16-8' },
      'SF-1': { a: 'QF-1', b: 'QF-2' },
      'SF-2': { a: 'QF-3', b: 'QF-4' },
      'F': { a: 'SF-1', b: 'SF-2' },
      '3RD': { a: 'SF-1', b: 'SF-2', loser: true },
    }

    for (const m of matches) {
      if (m.round === 'R32' && m.teamAId && m.teamBId) {
        picks[m.id] = Math.random() < 0.5 ? m.teamAId : m.teamBId
      }
    }

    const rounds = ['R16', 'QF', 'SF', 'F', '3RD'] as const
    for (const round of rounds) {
      const roundMatches = Object.entries(bracketTree).filter(([id]) => id.startsWith(round))
      for (const [matchId, src] of roundMatches) {
        const getWinner = (id: string) => picks[id] ?? null
        const getLoser = (id: string) => {
          const w = picks[id]
          const mm = matchMap.get(id)
          if (!w || !mm) return null
          return w === mm.teamAId ? mm.teamBId : mm.teamAId
        }

        const teamA = src.loser ? getLoser(src.a) : getWinner(src.a)
        const teamB = src.loser ? getLoser(src.b) : getWinner(src.b)

        const m = matchMap.get(matchId)
        if (m) {
          m.teamAId = teamA ?? null
          m.teamBId = teamB ?? null
        }
        if (teamA && teamB) {
          picks[matchId] = Math.random() < 0.5 ? teamA : teamB
        } else if (teamA) {
          picks[matchId] = teamA
        }
      }
    }

    setState(prev => ({
      ...prev,
      knockoutPredictions: picks,
      knockoutMatchups: matchupsFromKnockoutMatches(matches),
    }))
  }, [state.groupPredictions, state.tieBreakResolutions])

  const isPredictionComplete = (matchId: number) => {
    const p = state.groupPredictions[matchId]
    return hasCompleteScore(p?.scoreA, p?.scoreB)
  }

  const completedGroups = GROUPS.filter((group) => {
    const groupIndex = GROUPS.indexOf(group)
    const startMatchId = groupIndex * MATCHES_PER_GROUP + 1
    for (let i = 0; i < MATCHES_PER_GROUP; i++) {
      if (!isPredictionComplete(startMatchId + i)) return false
    }
    return true
  })

  const totalGroupPredictions = Object.values(state.groupPredictions).filter(
    (p) => hasCompleteScore(p.scoreA, p.scoreB),
  ).length
  const totalKnockoutPredictions = Object.keys(state.knockoutPredictions).length
  const predictionsLocked = isTournamentLocked()

  return (
    <PredictionsContext value={{
      ...state,
      setGroupPrediction,
      setKnockoutPrediction,
      setTieBreakResolution,
      submitPredictions,
      startEditingSubmission,
      cancelEditingSubmission,
      resetPredictions,
      autofillDemo,
      autofillAllOneZero,
      autofillGroupDemo,
      autofillKnockoutDemo,
      completedGroups,
      totalGroupPredictions,
      totalKnockoutPredictions,
      submitting,
      dbLoaded,
      hasActivePool: !!poolId,
      predictionsLocked,
      editingSubmission,
    }}>
      {children}
    </PredictionsContext>
  )
}

export function usePredictions(): PredictionsContextType {
  const context = useContext(PredictionsContext)
  if (!context) {
    throw new Error('usePredictions must be used within a PredictionsProvider')
  }
  return context
}
