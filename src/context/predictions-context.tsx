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

const STORAGE_KEY = 'wc2026-predictions'
const MATCHES_PER_GROUP = 6

interface PredictionsState {
  groupPredictions: Record<number, { scoreA: number; scoreB: number }>
  knockoutPredictions: Record<string, number>
  submitted: boolean
}

interface PredictionsContextType extends PredictionsState {
  setGroupPrediction: (matchId: number, scoreA: number, scoreB: number) => void
  setKnockoutPrediction: (matchId: string, winnerId: number) => void
  submitPredictions: () => void
  resetPredictions: () => void
  autofillDemo: () => void
  completedGroups: string[]
  totalGroupPredictions: number
}

const defaultState: PredictionsState = {
  groupPredictions: {},
  knockoutPredictions: {},
  submitted: false,
}

const PredictionsContext = createContext<PredictionsContextType | null>(null)

function loadFromStorage(): PredictionsState {
  if (typeof window === 'undefined') return defaultState
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultState
    return JSON.parse(stored) as PredictionsState
  } catch {
    return defaultState
  }
}

function saveToStorage(state: PredictionsState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

function getGroupForMatch(matchId: number): string | null {
  const groupIndex = Math.floor((matchId - 1) / MATCHES_PER_GROUP)
  return GROUPS[groupIndex] ?? null
}

export function PredictionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PredictionsState>(defaultState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(loadFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) saveToStorage(state)
  }, [state, hydrated])

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

  const submitPredictions = useCallback(() => {
    setState((prev) => ({ ...prev, submitted: true }))
  }, [])

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

  const completedGroups = GROUPS.filter((group) => {
    const groupIndex = GROUPS.indexOf(group)
    const startMatchId = groupIndex * MATCHES_PER_GROUP + 1
    for (let i = 0; i < MATCHES_PER_GROUP; i++) {
      if (!(startMatchId + i in state.groupPredictions)) return false
    }
    return true
  })

  const totalGroupPredictions = Object.keys(state.groupPredictions).length

  return (
    <PredictionsContext value={{
      ...state,
      setGroupPrediction,
      setKnockoutPrediction,
      submitPredictions,
      resetPredictions,
      autofillDemo,
      completedGroups,
      totalGroupPredictions,
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
