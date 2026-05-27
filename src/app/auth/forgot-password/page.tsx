'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthFields, getAuthModeCopy } from '@/components/auth/auth-flow'

export default function ForgotPasswordPage() {
  const copy = getAuthModeCopy('recovery')

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">{copy.icon}</div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFields mode="recovery" />
        </CardContent>
      </Card>
    </div>
  )
}
