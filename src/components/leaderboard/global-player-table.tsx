'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PoolFlag } from '@/components/pools/pool-flag'
import type { GlobalPlayer } from '@/lib/leaderboard/aggregate'

export function GlobalPlayerTable({
  players,
  countries,
  locked,
  currentUserId,
  pendingOnly,
}: {
  players: GlobalPlayer[]
  countries: Array<{ slug: string; name: string }>
  locked: boolean
  currentUserId?: string
  pendingOnly?: boolean
}) {
  const [country, setCountry] = useState('all')
  const filtered = useMemo(
    () => country === 'all' ? players : players.filter((p) => p.country === country),
    [country, players],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCountry('all')}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${country === 'all' ? 'border-primary bg-primary/10 text-foreground' : 'border-border/50 text-muted-foreground hover:bg-muted/50'}`}
        >
          All offices
        </button>
        {countries.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCountry(c.slug)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${country === c.slug ? 'border-primary bg-primary/10 text-foreground' : 'border-border/50 text-muted-foreground hover:bg-muted/50'}`}
          >
            <PoolFlag slug={c.slug} size={16} />
            {c.name.replace(' Office', '')}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet.</p>
        ) : (
          filtered.map((player, i) => (
            <PlayerRow key={player.userId} player={player} rank={i + 1} locked={locked} isOwn={player.userId === currentUserId} pendingOnly={pendingOnly} />
          ))
        )}
      </div>
    </section>
  )
}

function PlayerRow({ player, rank, locked, isOwn, pendingOnly }: { player: GlobalPlayer; rank: number; locked: boolean; isOwn: boolean; pendingOnly?: boolean }) {
  const statusBadge = player.submitted ? (
    pendingOnly ? null : (
      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Submitted
      </span>
    )
  ) : (
    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      Not submitted
    </span>
  )

  const content = (
    <>
      <span className="w-8 text-sm font-bold text-muted-foreground">#{rank}</span>
      <PoolFlag slug={player.country} size={24} />
      <span className="flex-1 text-sm font-medium">{player.displayName}</span>
      {statusBadge}
      <span className="w-10 text-right text-sm font-bold">{player.totalScore}</span>
    </>
  )

  if (!player.submitted) {
    return (
      <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0 opacity-60">
        {content}
      </div>
    )
  }

  if (locked || isOwn) {
    return (
      <Link
        href={`/pools/${player.country}/predictions/${player.userId}`}
        className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/30"
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => toast.info("Predictions will be visible once the tournament starts.")}
      className="flex w-full items-center gap-3 border-b border-border/30 px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-muted/30"
    >
      {content}
    </button>
  )
}
