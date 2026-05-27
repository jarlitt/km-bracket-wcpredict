'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AuthFields,
  getAuthModeCopy,
  type AuthMode,
} from '@/components/auth/auth-flow'

export function AuthModal({
  open,
  onOpenChange,
  initialMode,
  returnTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode: AuthMode
  returnTo: string
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const copy = getAuthModeCopy(mode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-center">
          <div className="text-3xl">{copy.icon}</div>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <AuthFields
          mode={mode}
          returnTo={returnTo}
          onModeChange={setMode}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
