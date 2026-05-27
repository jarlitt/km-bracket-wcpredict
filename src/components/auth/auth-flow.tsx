'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailInput } from '@/components/auth/email-input'
import { OFFICE_COUNTRIES, validateSignupFields } from '@/components/auth/auth-validation'
import { PoolFlag } from '@/components/pools/pool-flag'
import { useAuth, safeNextPath } from '@/context/auth-context'
import { cn } from '@/lib/utils'

export type AuthMode = 'login' | 'signup' | 'recovery'

export function getAuthModeCopy(mode: AuthMode) {
  if (mode === 'signup') {
    return {
      icon: '⚽',
      title: 'Create your account',
      description: 'Join the World Cup 2026 Predictor',
    }
  }
  if (mode === 'recovery') {
    return {
      icon: '🔑',
      title: 'Reset your password',
      description: 'Enter your email and we will send you a reset link',
    }
  }
  return {
    icon: '⚽',
    title: 'Welcome back',
    description: 'Log in to the World Cup 2026 Predictor',
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function AuthFields({
  mode,
  returnTo = '/',
  onModeChange,
  onSuccess,
}: {
  mode: AuthMode
  returnTo?: string
  onModeChange?: (mode: AuthMode) => void
  onSuccess?: () => void
}) {
  const { login, signup, resetPasswordRequest } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    country?: string
    general?: string
  }>({})

  const next = safeNextPath(returnTo)

  const switchMode = (nextMode: AuthMode) => {
    setErrors({})
    setSent(false)
    onModeChange?.(nextMode)
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!email) nextErrors.email = 'Email is required'
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address'
    if (!password) nextErrors.password = 'Password is required'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})
    const errorMsg = await login(email, password, next)
    setLoading(false)
    if (errorMsg) {
      setErrors({ general: errorMsg })
      return
    }
    onSuccess?.()
  }

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors = validateSignupFields({ displayName, email, password, country })
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors as typeof errors)
      return
    }

    setLoading(true)
    setErrors({})
    const errorMsg = await signup(email, password, displayName, country, next)
    setLoading(false)
    if (errorMsg) {
      setErrors({ general: errorMsg })
      return
    }
    onSuccess?.()
  }

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!email) nextErrors.email = 'Email is required'
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})
    const errorMsg = await resetPasswordRequest(email)
    setLoading(false)
    if (errorMsg) {
      setErrors({ general: errorMsg })
      return
    }
    setSent(true)
    toast.success('Password reset link sent.')
  }

  if (mode === 'recovery' && sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-sm text-emerald-300">
            We sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the link to reset your password.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => switchMode('login')}
        >
          Back to login
        </Button>
      </div>
    )
  }

  if (mode === 'signup') {
    return (
      <form onSubmit={handleSignup} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              setErrors((prev) => ({ ...prev, name: undefined }))
            }}
            className={cn(errors.name && 'ring-2 ring-destructive border-destructive')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label>Office country</Label>
          <div className="grid grid-cols-2 gap-2">
            {OFFICE_COUNTRIES.map((office) => (
              <button
                key={office.slug}
                type="button"
                onClick={() => {
                  setCountry(office.slug)
                  setErrors((prev) => ({ ...prev, country: undefined }))
                }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors',
                  country === office.slug
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/50 bg-card/40 text-muted-foreground hover:bg-card/70',
                )}
                aria-pressed={country === office.slug}
              >
                <PoolFlag slug={office.slug} size={20} />
                <span className="font-medium">{office.label}</span>
              </button>
            ))}
          </div>
          {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
        </div>
        <EmailInput
          value={email}
          onChange={(value) => {
            setEmail(value)
            setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          error={errors.email}
        />
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            className={cn(errors.password && 'ring-2 ring-destructive border-destructive')}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing up...' : 'Sign up'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-foreground underline underline-offset-4"
          >
            Log in
          </button>
        </p>
      </form>
    )
  }

  if (mode === 'recovery') {
    return (
      <form onSubmit={handleRecovery} noValidate className="space-y-4">
        <EmailInput
          value={email}
          onChange={(value) => {
            setEmail(value)
            setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          error={errors.email}
        />
        {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-foreground underline underline-offset-4"
          >
            Log in
          </button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleLogin} noValidate className="space-y-4">
      <EmailInput
        value={email}
        onChange={(value) => {
          setEmail(value)
          setErrors((prev) => ({ ...prev, email: undefined }))
        }}
        error={errors.email}
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => switchMode('recovery')}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          className={cn(errors.password && 'ring-2 ring-destructive border-destructive')}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
      </div>
      {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Logging in...' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className="text-foreground underline underline-offset-4"
        >
          Sign up
        </button>
      </p>
    </form>
  )
}
