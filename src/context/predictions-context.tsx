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
import { useAuth } from '@/context/auth-context'
import { loadPredictions, submitPredictionsToDb } from '@/app/actions/predictions'

const STORAGE_PREFIX = 'wc2026-predictions'
const MATCHES_PER_GROUP = 6

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}-${userId}`
}

interface PredictionsState {
  groupPredictions: Record<number, { scoreA: number; scoreB: number }>
  knockoutPredictions: Record<string, number>
  submitted: boolean
}

interface PredictionsContextType extends PredictionsState {
  setGroupPrediction: (matchId: number, scoreA: number, scoreB: number) => void
  setKnockoutPrediction: (matchId: string, winnerId: number) => void
  submitPredictions: () => Promise<string | null>
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
}

const defaultState: PredictionsState = {
  groupPredictions: {},
  knockoutPredictions: {},
  submitted: false,
}

const PredictionsContext = createContext<PredictionsContextType | null>(null)

function loadFromStorage(userId: string): PredictionsState {
  if (typeof window === 'undefined') return defaultState
  try {
    const stored = localStorage.getItem(storageKey(userId))
    if (!stored) return defaultState
    const parsed = JSON.parse(stored) as PredictionsState
    // Never trust localStorage for submitted status — DB is source of truth
    return { ...parsed, submitted: false }
  } catch {
    return defaultState
  }
}

function saveToStorage(userId: string, state: PredictionsState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

export function PredictionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PredictionsState>(defaultState)
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const { user } = useAuth()

  // Clean up old shared localStorage key from before per-user storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wc2026-predictions')
    }
  }, [])

  // When user changes, reset everything and load that user's data
  useEffect(() => {
    const newUserId = user?.id ?? null
    if (newUserId === activeUserId) return

    setActiveUserId(newUserId)
    setDbLoaded(false)
    setHydrated(false)

    if (!newUserId) {
      setState(defaultState)
      return
    }

    setState(loadFromStorage(newUserId))
    setHydrated(true)
  }, [user?.id, activeUserId])

  // Load from DB — this is the source of truth for submitted status
  useEffect(() => {
    if (!user || dbLoaded) return

    loadPredictions().then((dbData) => {
      if (!dbData) {
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
        // DB is the single source of truth for submitted status
        submitted: dbData.submitted,
      }))
      setDbLoaded(true)
    })
  }, [user, dbLoaded])

  // Persist drafts to localStorage (per-user)
  useEffect(() => {
    if (hydrated && activeUserId) saveToStorage(activeUserId, state)
  }, [state, hydrated, activeUserId])

  const setGroupPrediction = useCallback(
    (matchId: number, scoreA: number, scoreB: number) => {
      setState((prev) => ({
        ...prev,
        groupPredictions: {
          ...prev.groupPredictions,
          [matchId]: { scoreA, scoreB },
        },
      }))
    },
    []
  )

  const setKnockoutPrediction = useCallback(
    (matchId: string, winnerId: number) => {
      setState((prev) => ({
        ...prev,
        knockoutPredictions: {
          ...prev.knockoutPredictions,
          [matchId]: winnerId,
        },
      }))
    },
    []
  )

  const submitPredictions = useCallback(async (): Promise<string | null> => {
    setSubmitting(true)
    try {
      const result = await submitPredictionsToDb(
        state.groupPredictions,
        state.knockoutPredictions
      )
      if (!result.success) {
        return result.error ?? 'Failed to submit predictions'
      }
      setState((prev) => ({ ...prev, submitted: true }))
      return null
    } finally {
      setSubmitting(false)
    }
  }, [state.groupPredictions, state.knockoutPredictions])

  const resetPredictions = useCallback(() => {
    setState(defaultState)
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

    setState(prev => ({ ...prev, groupPredictions, knockoutPredictions: {} }))
  }, [])

  const autofillAllOneZero = useCallback(() => {
    const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}
    for (const match of GROUP_MATCHES) {
      groupPredictions[match.id] = { scoreA: 1, scoreB: 0 }
    }
    setState(prev => ({ ...prev, groupPredictions, knockoutPredictions: {} }))
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

  const autofillKnockoutDemo = useCallback(() => {
    const gp = state.groupPredictions
    if (Object.keys(gp).length < 72) return

    const allStandings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      allStandings[group] = calculateGroupStandings(group, gp)
    }
    const { qualifiedGroups } = determineBestThirdPlaceTeams(allStandings)
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

    setState(prev => ({ ...prev, knockoutPredictions: picks }))
  }, [state.groupPredictions])

  const completedGroups = GROUPS.filter((group) => {
    const groupIndex = GROUPS.indexOf(group)
    const startMatchId = groupIndex * MATCHES_PER_GROUP + 1
    for (let i = 0; i < MATCHES_PER_GROUP; i++) {
      if (!(startMatchId + i in state.groupPredictions)) return false
    }
    return true
  })

  const totalGroupPredictions = Object.keys(state.groupPredictions).length
  const totalKnockoutPredictions = Object.keys(state.knockoutPredictions).length

  return (
    <PredictionsContext value={{
      ...state,
      setGroupPrediction,
      setKnockoutPrediction,
      submitPredictions,
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
