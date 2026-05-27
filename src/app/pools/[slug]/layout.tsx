'use client'

import { use } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CopyPredictionsDialog } from '@/components/pools/copy-predictions-dialog'
import { LeavePoolButton } from '@/components/pools/leave-pool-button'
import { PoolSwitcher } from '@/components/pools/pool-switcher'
import { usePools } from '@/context/pool-context'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default function PoolScopedLayout({ children, params }: Props) {
  const { slug } = use(params)
  const pathname = usePathname()
  const { availablePools, loading } = usePools()
  const poolExists = availablePools.some((p) => p.slug === slug)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-muted-foreground">
        Loading pool...
      </div>
    )
  }

  if (!poolExists) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Pool not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find a pool with the slug{' '}
          <code className="rounded bg-muted px-1 text-foreground">{slug}</code>.
        </p>
        <Link href="/pools">
          <Button>See available pools</Button>
        </Link>
      </div>
    )
  }

  const predictHref = '/predict/groups'
  const standingsHref = `/pools/${slug}/dashboard`
  const isPredictActive = pathname.startsWith('/predict')
  const isStandingsActive = pathname.startsWith(`/pools/${slug}/dashboard`)

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="sticky top-14 z-40 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-col items-start gap-2">
            <PoolSwitcher />
            <div className="flex flex-wrap items-center gap-2">
              <CopyPredictionsDialog />
              <LeavePoolButton />
            </div>
          </div>
          <nav className="flex items-center gap-1" aria-label="Pool sections">
            <PoolTab href={predictHref} active={isPredictActive}>
              My Predictions
            </PoolTab>
            <PoolTab href={standingsHref} active={isStandingsActive}>
              Pool Standings
            </PoolTab>
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
}

function PoolTab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-3 h-0.5 rounded-full bg-primary" />
      )}
    </Link>
  )
}
