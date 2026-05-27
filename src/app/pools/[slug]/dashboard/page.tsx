'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/auth-context'
import { usePools } from '@/context/pool-context'
import {
  getLeaderboard,
  type LeaderboardEntry,
} from '@/app/actions/leaderboard'
import type { Pool } from '@/types'

export default function PoolDashboardPage() {
  const { user } = useAuth()
  const { slug } = useParams<{ slug: string }>()
  const { availablePools, loading: poolsLoading } = usePools()

  const pool: Pool | null =
    availablePools.find((p) => p.slug === slug) ?? null

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!pool) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setLeaderboard([])
        setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }
    // Mark loading and fetch in a microtask so React doesn't see a synchronous
    // setState inside the effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
      getLeaderboard(pool.id).then((data) => {
        if (cancelled) return
        setLeaderboard(data)
        setLoading(false)
      })
    })
    return () => {
      cancelled = true
    }
  }, [pool])

  if (poolsLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  const myEntry = leaderboard.find((e) => e.userId === user?.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          {pool ? pool.name : 'Leaderboard'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track scores and rankings within this pool.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Your Rank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {myEntry ? `#${myEntry.rank}` : '--'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {myEntry?.totalScore ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Group Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {myEntry
                ? myEntry.groupMatchPoints +
                  myEntry.exactScoreBonus +
                  myEntry.groupPositionPoints
                : 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Knockout Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {myEntry?.knockoutPoints ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-bold mb-4">Leaderboard</h2>
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-center">Group</TableHead>
                <TableHead className="text-center">Knockout</TableHead>
                <TableHead className="text-center font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground text-sm py-8"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : leaderboard.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground text-sm py-8"
                  >
                    No members in this pool yet.
                  </TableCell>
                </TableRow>
              ) : (
                leaderboard.map((entry) => (
                  <TableRow key={entry.userId} className="border-border/20">
                    <TableCell className="text-center font-bold">
                      {entry.rank}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {entry.displayName}
                        </span>
                        {entry.userId === user?.id && (
                          <Badge variant="secondary" className="text-[10px]">
                            You
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {entry.groupMatchPoints +
                        entry.exactScoreBonus +
                        entry.groupPositionPoints}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {entry.knockoutPoints}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {entry.totalScore}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
