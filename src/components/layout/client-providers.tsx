'use client'

import { AuthProvider } from '@/context/auth-context'
import { PoolProvider } from '@/context/pool-context'
import { PredictionsProvider } from '@/context/predictions-context'
import { Navbar } from '@/components/layout/navbar'
import { usePathname } from 'next/navigation'

const AUTH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
]

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = AUTH_PATHS.some(p => pathname.startsWith(p))

  return (
    <AuthProvider>
      {isAuthPage ? (
        children
      ) : (
        <PoolProvider>
          <PredictionsProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
          </PredictionsProvider>
        </PoolProvider>
      )}
    </AuthProvider>
  )
}
