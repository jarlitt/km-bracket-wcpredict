'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const PUBLIC_PATHS = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password']

interface User {
  id: string
  email: string
  displayName: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  signup: (email: string, password: string, displayName: string) => Promise<string | null>
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
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
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
  }, [supabase.auth])

  useEffect(() => {
    if (loading) return
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
    if (!user && !isPublic) {
      router.replace('/auth/login')
    }
    if (user && isPublic) {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    router.replace('/')
    return null
  }, [supabase.auth, router])

  const signup = useCallback(async (email: string, password: string, displayName: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return error.message
    router.replace('/')
    return null
  }, [supabase.auth, router])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.replace('/auth/login')
  }, [supabase.auth, router])

  const resetPasswordRequest = useCallback(async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) return error.message
    return null
  }, [supabase.auth])

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return error.message
    return null
  }, [supabase.auth])

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!user && !isPublic) {
    return null
  }

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
