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

const STORAGE_KEY = 'wc2026-auth'
const PUBLIC_PATHS = ['/auth/login', '/auth/signup']

interface User {
  id: string
  email: string
  displayName: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function loadUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setUser(loadUser())
    setLoading(false)
  }, [])

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

  const login = useCallback(async (email: string, _password: string) => {
    const existingUsers = JSON.parse(localStorage.getItem('wc2026-users') || '[]') as User[]
    const found = existingUsers.find(u => u.email === email)

    const newUser: User = found ?? {
      id: generateId(),
      email,
      displayName: email.split('@')[0],
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    setUser(newUser)
    router.replace('/')
  }, [router])

  const signup = useCallback(async (email: string, _password: string, displayName: string) => {
    const newUser: User = { id: generateId(), email, displayName }

    const existingUsers = JSON.parse(localStorage.getItem('wc2026-users') || '[]') as User[]
    existingUsers.push(newUser)
    localStorage.setItem('wc2026-users', JSON.stringify(existingUsers))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    setUser(newUser)
    router.replace('/')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
    router.replace('/auth/login')
  }, [router])

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
    <AuthContext value={{ user, loading, login, signup, logout }}>
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
