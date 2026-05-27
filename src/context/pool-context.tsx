'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/context/auth-context'
import { listAvailablePools } from '@/app/actions/pools'
import type { Pool } from '@/types'

interface PoolContextType {
  availablePools: Pool[]
  userPool: Pool | null
  loading: boolean
  refresh: () => Promise<void>
}

const PoolContext = createContext<PoolContextType | null>(null)

export function PoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [availablePools, setAvailablePools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const pools = await listAvailablePools()
    setAvailablePools(pools)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const pools = await listAvailablePools()
      if (cancelled) return
      setAvailablePools(pools)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user])

  const userPool = useMemo(
    () => availablePools.find((pool) => pool.slug === user?.country) ?? null,
    [availablePools, user?.country],
  )

  return (
    <PoolContext value={{ availablePools, userPool, loading, refresh }}>
      {children}
    </PoolContext>
  )
}

export function usePools(): PoolContextType {
  const ctx = useContext(PoolContext)
  if (!ctx) throw new Error('usePools must be used within a PoolProvider')
  return ctx
}
