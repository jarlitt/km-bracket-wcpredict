'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import {
  getMyPoolSummaries,
  listAvailablePools,
  listMyMemberships,
  type MyPoolSummary,
} from '@/app/actions/pools'
import type { Pool, PoolMembership } from '@/types'
import {
  ACTIVE_POOL_STORAGE_KEY,
  resolveActivePoolForContext,
} from '@/lib/pools/active-pool'

const POOL_URL_SLUG_RE = /^\/pools\/([^/]+)(\/|$)/

function slugFromPath(pathname: string | null): string | null {
  if (!pathname) return null
  const match = POOL_URL_SLUG_RE.exec(pathname)
  return match ? match[1] : null
}

interface PoolContextType {
  availablePools: Pool[]
  memberships: PoolMembership[]
  myPoolSummaries: MyPoolSummary[]
  activePool: Pool | null
  loading: boolean
  setActivePoolBySlug: (slug: string) => void
  refresh: () => Promise<void>
}

const PoolContext = createContext<PoolContextType | null>(null)

const ACTIVE_POOL_EVENT = 'wc2026-active-pool-changed'

function subscribeActiveSlug(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(ACTIVE_POOL_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(ACTIVE_POOL_EVENT, callback)
  }
}

function getActiveSlugSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_POOL_STORAGE_KEY)
  } catch {
    return null
  }
}

function getServerActiveSlugSnapshot(): string | null {
  return null
}

export function PoolProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [availablePools, setAvailablePools] = useState<Pool[]>([])
  const [memberships, setMemberships] = useState<PoolMembership[]>([])
  const [myPoolSummaries, setMyPoolSummaries] = useState<MyPoolSummary[]>([])
  const [loading, setLoading] = useState(true)

  const storedSlug = useSyncExternalStore(
    subscribeActiveSlug,
    getActiveSlugSnapshot,
    getServerActiveSlugSnapshot,
  )

  // URL is the source of truth when we're inside `/pools/[slug]/...`. This
  // avoids a flash where downstream consumers see the previous active pool
  // before the layout's effect updates localStorage.
  const urlSlug = slugFromPath(pathname)

  const refresh = useCallback(async () => {
    // Available pools are public (anon can preview them); memberships only
    // exist for signed-in users.
    const [pools, mine, summaries] = await Promise.all([
      listAvailablePools(),
      user ? listMyMemberships() : Promise.resolve([] as PoolMembership[]),
      user ? getMyPoolSummaries() : Promise.resolve([] as MyPoolSummary[]),
    ])
    setAvailablePools(pools)
    setMemberships(mine)
    setMyPoolSummaries(summaries)
    setLoading(false)
  }, [user])

  // Load pool data whenever the user changes. All setState calls happen
  // inside the Promise.all callback so we don't trigger
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [pools, mine, summaries] = await Promise.all([
        listAvailablePools(),
        user ? listMyMemberships() : Promise.resolve([] as PoolMembership[]),
        user ? getMyPoolSummaries() : Promise.resolve([] as MyPoolSummary[]),
      ])
      if (cancelled) return
      setAvailablePools(pools)
      setMemberships(mine)
      setMyPoolSummaries(summaries)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user])

  // For pool-scoped routes, the URL is the source of truth. Outside those
  // routes, fall back to the user's stored/member active pool.
  const activePool = useMemo(() => {
    return resolveActivePoolForContext(
      urlSlug,
      storedSlug,
      memberships,
      availablePools,
    )
  }, [urlSlug, storedSlug, memberships, availablePools])

  const setActivePoolBySlug = useCallback((slug: string) => {
    try {
      window.localStorage.setItem(ACTIVE_POOL_STORAGE_KEY, slug)
      // Notify same-tab subscribers; 'storage' only fires cross-tab.
      window.dispatchEvent(new Event(ACTIVE_POOL_EVENT))
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <PoolContext value={{
      availablePools,
      memberships,
      myPoolSummaries,
      activePool,
      loading,
      setActivePoolBySlug,
      refresh,
    }}>
      {children}
    </PoolContext>
  )
}

export function usePools(): PoolContextType {
  const ctx = useContext(PoolContext)
  if (!ctx) throw new Error('usePools must be used within a PoolProvider')
  return ctx
}
