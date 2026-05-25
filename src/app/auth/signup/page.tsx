'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailInput } from '@/components/auth/email-input'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

export default function SignupPage() {
  const { signup } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!displayName) newErrors.name = 'Name is required'
    if (!email) newErrors.email = 'Email is required'
    else if (!email.includes('@')) newErrors.email = 'Enter a valid email address'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Must be at least 6 characters'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    const errorMsg = await signup(email, password, displayName)
    if (errorMsg) setErrors({ general: errorMsg })
  }

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">⚽</div>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Join the KingMakers WC2026 Predictor</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })) }}
                className={cn(errors.name && 'ring-2 ring-destructive border-destructive')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <EmailInput value={email} onChange={v => { setEmail(v); setErrors(prev => ({ ...prev, email: undefined })) }} error={errors.email} />
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })) }}
                className={cn(errors.password && 'ring-2 ring-destructive border-destructive')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}
            <button type="submit" className={buttonVariants({ className: 'w-full' })}>
              Sign up
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
