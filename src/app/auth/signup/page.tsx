'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth, safeNextPath } from '@/context/auth-context'
import { AuthFields, getAuthModeCopy } from '@/components/auth/auth-flow'

function SignupForm() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const copy = getAuthModeCopy('signup')

  useEffect(() => {
    if (!loading && user) router.replace(next)
  }, [loading, user, next, router])

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">{copy.icon}</div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFields
            mode="signup"
            returnTo={next}
            onModeChange={(nextMode) => {
              const params = new URLSearchParams()
              if (next !== '/') params.set('next', next)
              if (nextMode === 'recovery') params.set('mode', 'recovery')
              router.push(`/auth/login${params.size ? `?${params}` : ''}`)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
