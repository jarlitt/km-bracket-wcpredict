'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function EmailInput({ value, onChange, error }: EmailInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(error && 'ring-2 ring-destructive border-destructive')}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
