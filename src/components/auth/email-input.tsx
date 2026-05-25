'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const DOMAINS = ['@gmail.com', '@kingmakers.com']

interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function EmailInput({ value, onChange, error }: EmailInputProps) {
  const handleDomain = (domain: string) => {
    const local = value.split('@')[0]
    if (local) onChange(local + domain)
  }

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
      {value.length > 0 && !value.includes('@') && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Quick fill:</span>
          {DOMAINS.map(domain => (
            <button
              key={domain}
              type="button"
              onClick={() => handleDomain(domain)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors truncate max-w-full"
            >
              {value.split('@')[0]}{domain}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
