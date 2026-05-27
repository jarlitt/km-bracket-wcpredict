'use client'

import { ArrowRight, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const POOL_FLAG_BY_SLUG: Record<string, string> = {
  spain: 'spain.svg',
  malta: 'malta.svg',
  nigeria: 'nigeria.svg',
  'south-africa': 'south-africa.svg',
  zambia: 'zambia.svg',
  uk: 'united-kingdom.svg',
}

export function PoolFlag({
  slug,
  size = 32,
  className,
}: {
  slug: string
  size?: number
  className?: string
}) {
  const file = POOL_FLAG_BY_SLUG[slug]
  if (!file) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Globe className="size-4" />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-card',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/country-flags/Countries/${file}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="block h-full w-full object-cover"
      />
    </span>
  )
}

export function ArrowChip({ disabled = false }: { disabled?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
        disabled
          ? 'border-border/30 bg-muted/40 text-muted-foreground/60'
          : 'border-border/40 bg-muted/40 text-muted-foreground group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary',
      )}
      aria-hidden="true"
    >
      <ArrowRight className="size-3.5" />
    </span>
  )
}
