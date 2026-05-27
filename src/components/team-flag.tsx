import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { Team } from '@/types'

interface Props {
  team?: Team | null
  /** Pixel size for both width and height. Defaults to 20. */
  size?: number
  className?: string
  /** Fallback emoji to render if no team or slug is available. */
  fallback?: string | null
}

/**
 * Renders a country flag SVG from /public/country-flags/Countries/.
 * Falls back to the team's emoji flag if the SVG can't be found.
 */
export function TeamFlag({ team, size = 20, className, fallback }: Props) {
  if (!team) {
    return fallback ? (
      <span
        className={cn('inline-block leading-none', className)}
        style={{ fontSize: size }}
      >
        {fallback}
      </span>
    ) : null
  }

  const src = `/country-flags/Countries/${encodeURIComponent(team.flagSlug)}.svg`

  return (
    <Image
      src={src}
      alt={team.name}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
      unoptimized
    />
  )
}
