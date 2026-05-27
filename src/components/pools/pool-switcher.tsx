'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PoolFlag } from '@/components/pools/pool-flag'
import { usePools } from '@/context/pool-context'

interface Props {
  className?: string
}

export function PoolSwitcher({ className }: Props) {
  const { userPool } = usePools()

  if (!userPool) {
    return (
      <Link href="/pools">
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          View pools
        </Button>
      </Link>
    )
  }

  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-2 px-0 py-0 text-left sm:gap-3',
        className,
      )}
    >
      <PoolFlag
        slug={userPool.slug}
        size={36}
        className="inline-flex sm:[width:40px] sm:[height:40px]"
      />
      <span className="min-w-0">
        <span className="block truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {userPool.name}
        </span>
      </span>
    </div>
  )
}
