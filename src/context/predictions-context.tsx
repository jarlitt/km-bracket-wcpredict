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
  readAnonDraft,
  readPredictionsFromStorage,
  readSubmittedSnapshot,
  writeAnonDraft,
  writePredictionsToStorage,
  writeSubmittedSnapshot,
  clearSubmittedSnapshot,
  type PredictionsState,
} from '@/lib/predictions/storage'
import { computeIsDirty } from '@/lib/predictions/dirty'
import { migrateAnonDraftToCountryPool } from '@/lib/predictions/anon-migration'
import { hasCompleteScore } from '@/lib/predictions/completeness'
import { isTournamentLocked } from '@/lib/matches/lock'
import type { KnockoutMatchup } from '@/types'

const MATCHES_PER_GROUP = 6

interface PredictionsContextType extends PredictionsState {
  setGroupPrediction: (matchId: number, scoreA: number | undefined, scoreB: number | undefined) => void
  setKnockoutPrediction: (matchId: string, winnerId: number) => void
  setTieBreakResolution: (key: string, teamOrder: number[]) => void
  submitPredictions: (knockoutMatchups?: Record<string, KnockoutMatchup>) => Promise<string | null>
  discardUnsavedChanges: () => void
  resetPredictions: () => void
  autofillDemo: () => void
  autofillAllOneZero: () => void
  autofillGroupDemo: (groupId: string) => void
  autofillMatchDemo: (matchId: number) => void
  autofillKnockoutDemo: () => void
  completedGroups: string[]
  totalGroupPredictions: number
  totalKnockoutPredictions: number
  submitting: boolean
  dbLoaded: boolean
  predictionsLocked: boolean
  isDirty: boolean
  submittedSnapshot: PredictionsState | null
}

const PredictionsContext = createContext<PredictionsContextType | null>(null)

function loadFromStorage(
  userId: string | null,
  poolId: string | null,
): PredictionsState {
  if (typeof window === 'undefined') return defaultPredictionsState

  // Anonymous users persist a single pool-less draft so picks survive the
  // sign-up/login → remount cycle (PredictionsProvider remounts on key change).
  if (!userId) return readAnonDraft(window.localStorage)

  if (!poolId) return defaultPredictionsState

  // Authed user with a known pool — migrate any anon draft into their scope
  // first so picks made before logging in are preserved on login (signup also
  // migrates eagerly in auth-context, but login does not).
  migrateAnonDraftToCountryPool(window.localStorage, userId, poolId)
  return readPredictionsFromStorage(window.localStorage, userId, poolId)
}

function saveToStorage(
  userId: string | null,
  poolId: string | null,
  state: PredictionsState,
) {
  if (typeof window === 'undefined') return

  if (!userId) {
    writeAnonDraft(window.localStorage, state)
    return
  }

  if (poolId) writePredictionsToStorage(window.localStorage, userId, poolId, state)
}

function loadSnapshotFromStorage(
  userId: string | null,
  poolId: string | null,
): PredictionsState | null {
  if (typeof window === 'undefined') return null
  if (!userId || !poolId) return null
  return readSubmittedSnapshot(window.localStorage, userId, poolId)
}

function saveSnapshotToStorage(
  userId: string | null,
  poolId: string | null,
  snapshot: PredictionsState,
) {
  if (typeof window === 'undefined') return
  if (!userId || !poolId) return
  writeSubmittedSnapshot(window.localStorage, userId, poolId, snapshot)
}

function clearSnapshotInStorage(
  userId: string | null,
  poolId: string | null,
) {
  if (typeof window === 'undefined') return
  if (!userId || !poolId) return
  clearSubmittedSnapshot(window.localStorage, userId, poolId)
}

/**
 * Renders a fresh PredictionsProvider whenever the active (user, pool) pair
 * changes. The `key` remount means we never need a useEffect to reset state
 * inside the provider itself — React tears down and re-creates the subtree.
 */
export function PredictionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { userPool } = usePools()
  const userId = user?.id ?? null
  const poolId = userPool?.id ?? null

  return (
    <ScopedPredictionsProvider
      key={`${userId ?? 'anon'}:${poolId ?? 'none'}`}
      userId={userId}
      poolId={poolId}
    >
      {children}
    </ScopedPredictionsProvider>
  )
}

interface ScopedProps {
  userId: string | null
  poolId: string | null
  children: ReactNode
}

function ScopedPredictionsProvider({
  userId,
  poolId,
  children,
}: ScopedProps) {
  // Seed from localStorage lazily so we don't need an effect to do it.
  const [state, setState] = useState<PredictionsState>(() =>
    loadFromStorage(userId, poolId),
  )
  const [submitting, setSubmitting] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [submittedSnapshot, setSubmittedSnapshot] = useState<PredictionsState | null>(() =>
    loadSnapshotFromStorage(userId, poolId),
  )

  // Hydrate from DB. All setStates live inside the .then() callback so the
  // synchronous body of the effect never touches state.
  useEffect(() => {
    if (!userId || !poolId) {
      return
    }
    let cancelled = false
    loadPredictions().then((dbData) => {
      if (cancelled) return
      if (!dbData) {
        setDbLoaded(true)
        return
      }
      if (dbData.submitted) {
        const dbSnapshot: PredictionsState = {
          groupPredictions: dbData.groupPredictions,
          knockoutPredictions: dbData.knockoutPredictions,
          knockoutMatchups: dbData.knockoutMatchups,
          tieBreakResolutions: dbData.tieBreakResolutions,
          submitted: true,
        }
        setSubmittedSnapshot(dbSnapshot)
        saveSnapshotToStorage(userId, poolId, dbSnapshot)
      } else {
        setSubmittedSnapshot(null)
        clearSnapshotInStorage(userId, poolId)
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
  }, [userId, poolId])

  // Persist drafts to localStorage. Anonymous users save under the
  // 'anon:draft' scope so their picks carry over on signup/login (see
  // loadFromStorage), authed users save under their user/pool scope.
  useEffect(() => {
    saveToStorage(userId, poolId, state)
  }, [state, userId, poolId])

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
    },
    [buildKnockoutMatchesForState],
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
        state.groupPredictions,
        state.knockoutPredictions,
        submittedMatchups,
      )
      if (!result.success) {
        return result.error ?? 'Failed to submit predictions'
      }
      const nextState: PredictionsState = {
        ...state,
        knockoutMatchups: submittedMatchups,
        submitted: true,
      }
      const snapshot: PredictionsState = structuredClone(nextState)
      setState(nextState)
      setSubmittedSnapshot(snapshot)
      saveSnapshotToStorage(userId, poolId, snapshot)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [
    poolId,
    state,
    userId,
    buildCurrentKnockoutMatchups,
  ])

  const discardUnsavedChanges = useCallback(() => {
    if (!submittedSnapshot) return
    setState(structuredClone(submittedSnapshot))
  }, [submittedSnapshot])

  const resetPredictions = useCallback(() => {
    setState(defaultPredictionsState)
  }, [])

  const autofillDemo = useCallback(() => {
    const salt = Date.now()
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed + salt) * 10000
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
  }, [])

  const autofillAllOneZero = useCallback(() => {
    const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}
    for (const match of GROUP_MATCHES) {
      groupPredictions[match.id] = { scoreA: 1, scoreB: 0 }
    }
    setState(prev => ({ ...prev, groupPredictions, knockoutPredictions: {}, knockoutMatchups: {} }))
  }, [])

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
  }, [])

  // Single-match version of the autofill heuristic above. Keeps the same
  // strength-vs-strength scoring shape so a "dice this match" tap reads as
  // plausibly as the whole-group autofill.
  const autofillMatchDemo = useCallback((matchId: number) => {
    const match = GROUP_MATCHES.find(m => m.id === matchId)
    if (!match) return

    const teams = getTeamsByGroup(match.groupId)
    const aIdx = teams.findIndex(t => t.id === match.teamAId)
    const bIdx = teams.findIndex(t => t.id === match.teamBId)
    const aStrength = 3 - aIdx
    const bStrength = 3 - bIdx
    const r = Math.random()

    let scoreA: number
    let scoreB: number
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

    setGroupPrediction(matchId, scoreA, scoreB)
  }, [setGroupPrediction])

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
  const isDirty = computeIsDirty(state, submittedSnapshot)
  const predictionsLocked = isTournamentLocked()

  return (
    <PredictionsContext value={{
      ...state,
      setGroupPrediction,
      setKnockoutPrediction,
      setTieBreakResolution,
      submitPredictions,
      discardUnsavedChanges,
      resetPredictions,
      autofillDemo,
      autofillAllOneZero,
      autofillGroupDemo,
      autofillMatchDemo,
      autofillKnockoutDemo,
      completedGroups,
      totalGroupPredictions,
      totalKnockoutPredictions,
      submitting,
      dbLoaded,
      predictionsLocked,
      isDirty,
      submittedSnapshot,
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
