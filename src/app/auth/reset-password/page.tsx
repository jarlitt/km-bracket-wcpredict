'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)
  const recoveryError = searchParams.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: typeof errors = {}

    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Must be at least 6 characters'

    if (!confirm) newErrors.confirm = 'Please confirm your password'
    else if (password !== confirm) newErrors.confirm = 'Passwords do not match'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)
    const errorMsg = await updatePassword(password)
    setLoading(false)

    if (errorMsg) {
      setErrors({ general: errorMsg })
    } else {
      toast.success('Password updated successfully!')
      router.replace('/')
    }
  }

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">🔒</div>
          <CardTitle className="text-xl">Set new password</CardTitle>
          <CardDescription>
            {recoveryError
              ? 'This reset link is invalid or expired'
              : 'Enter your new password below'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recoveryError ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <p className="text-sm text-amber-300">
                  Password reset links can only be used once and may expire.
                  Request a fresh link to continue.
                </p>
              </div>
              <Link href="/auth/forgot-password">
                <Button className="w-full">Send a new reset link</Button>
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(prev => ({ ...prev, confirm: undefined })) }}
                className={cn(errors.confirm && 'ring-2 ring-destructive border-destructive')}
              />
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
            </div>
            {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}
            <button
              type="submit"
              disabled={loading}
              className={buttonVariants({ className: 'w-full' })}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
