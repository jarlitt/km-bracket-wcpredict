'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PoolFlag } from '@/components/pools/pool-flag'
import type { GlobalPlayer, CountryStanding } from '@/lib/leaderboard/aggregate'

interface HomeLeaderboardProps {
  players: GlobalPlayer[]
  countries: CountryStanding[]
  currentUserId?: string
  locked: boolean
}

function rankColor(rank: number): string | undefined {
  if (rank === 1) return '#fbbf24'
  if (rank === 2) return '#94a3b8'
  if (rank === 3) return '#d97706'
  return undefined
}

export function HomeLeaderboard({
  players,
  countries,
  currentUserId,
  locked,
}: HomeLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<string>('global')

  const filteredPlayers =
    activeTab === 'global'
      ? players
      : players.filter((p) => p.country === activeTab)

  const reranked = filteredPlayers.map((p, i) => ({ ...p, rank: i + 1 }))
  const top10 = reranked.slice(0, 10)

  const currentUser = currentUserId
    ? reranked.find((p) => p.userId === currentUserId)
    : null
  const showYouRow = currentUser && !top10.some((p) => p.userId === currentUserId)
  const showAnonRow = !currentUserId

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Leaderboard</h2>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/40 bg-card/30 p-1">
        <button
          onClick={() => setActiveTab('global')}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'global'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Global
        </button>
        {countries.map((c) => (
          <button
            key={c.slug}
            onClick={() => setActiveTab(c.slug)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === c.slug
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PoolFlag slug={c.slug} size={14} />
            {c.name.replace(/ Office$/, '')}
          </button>
        ))}
      </div>

      {/* Player rows */}
      <div className="space-y-1">
        {top10.map((player) => (
          <PlayerRow
            key={player.userId}
            player={player}
            locked={locked}
            isCurrentUser={player.userId === currentUserId}
          />
        ))}

        {showYouRow && currentUser && (
          <>
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="text-xs text-muted-foreground/50">···</span>
            </div>
            <PlayerRow
              player={currentUser}
              locked={locked}
              isCurrentUser
            />
          </>
        )}

        {showAnonRow && (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-card/20 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              <Link href="/auth/signup" className="text-indigo-400 hover:underline">
                Sign up
              </Link>{' '}
              to join the leaderboard
            </span>
          </div>
        )}
      </div>

      <div className="text-center">
        <Link
          href="/leaderboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View full leaderboard →
        </Link>
      </div>
    </section>
  )
}

function PlayerRow({
  player,
  locked,
  isCurrentUser,
}: {
  player: GlobalPlayer & { rank: number }
  locked: boolean
  isCurrentUser: boolean
}) {
  const color = rankColor(player.rank)
  const score = locked && player.totalScore > 0 ? player.totalScore : null

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        isCurrentUser
          ? 'border border-indigo-500/30 bg-indigo-950/40'
          : 'border border-transparent'
      }`}
    >
      <span
        className="w-6 text-right text-xs font-bold tabular-nums"
        style={color ? { color } : undefined}
      >
        {player.rank}
      </span>

      <span className="flex-1 truncate">
        {isCurrentUser ? 'You' : player.displayName}
        {isCurrentUser && !player.submitted && (
          <span className="ml-2 text-xs text-muted-foreground">(not submitted)</span>
        )}
        {isCurrentUser && player.submitted && (
          <span className="ml-2 text-xs text-emerald-400">✓ submitted</span>
        )}
      </span>

      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
        {score != null ? score : '—'}
      </span>
    </div>
  )
}
