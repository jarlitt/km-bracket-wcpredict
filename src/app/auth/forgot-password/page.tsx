'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const { resetPasswordRequest } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Email is required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }

    setLoading(true)
    const errorMsg = await resetPasswordRequest(email)
    setLoading(false)

    if (errorMsg) {
      setError(errorMsg)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">🔑</div>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            {sent
              ? 'Check your email for a reset link'
              : 'Enter your email and we\'ll send you a reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-sm text-emerald-300">
                  We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
                </p>
              </div>
              <Link href="/auth/login" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  className={cn(error && 'ring-2 ring-destructive border-destructive')}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className={buttonVariants({ className: 'w-full' })}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/auth/login" className="text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
