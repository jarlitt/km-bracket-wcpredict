'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeNextPath } from '@/lib/auth/safe-next'
import { migrateAnonDraftToCountryPool } from '@/lib/predictions/anon-migration'
import { listAvailablePools } from '@/app/actions/pools'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export { safeNextPath }

interface User {
  id: string
  email: string
  displayName: string
  country: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  /** Returns null on success or an error message string. `next` is honored for the post-auth redirect. */
  login: (email: string, password: string, next?: string) => Promise<string | null>
  signup: (email: string, password: string, displayName: string, country: string, next?: string) => Promise<string | null>
  logout: () => void
  resetPasswordRequest: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

function mapSupabaseUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? '',
    displayName: u.user_metadata?.display_name ?? u.email?.split('@')[0] ?? 'User',
    country: u.user_metadata?.country ?? '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? mapSupabaseUser(data.user) : null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/auth/reset-password')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

  const login = useCallback(async (email: string, password: string, next?: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    router.replace(safeNextPath(next))
    return null
  }, [supabase.auth, router])

  const signup = useCallback(async (email: string, password: string, displayName: string, country: string, next?: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, country } },
    })
    if (error) return error.message

    if (typeof window !== 'undefined' && data.user) {
      try {
        const pools = await listAvailablePools()
        const pool = pools.find(p => p.slug === country)
        if (pool) {
          migrateAnonDraftToCountryPool(window.localStorage, data.user.id, pool.id)
        }
      } catch {
        // Best-effort migration — don't block signup on failure
      }
    }

    router.replace('/predict/groups')
    return null
  }, [supabase.auth, router])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.replace('/')
  }, [supabase.auth, router])

  const resetPasswordRequest = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    if (error) return error.message
    return null
  }, [supabase.auth])

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return error.message
    return null
  }, [supabase.auth])

  return (
    <AuthContext value={{ user, loading, login, signup, logout, resetPasswordRequest, updatePassword }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
