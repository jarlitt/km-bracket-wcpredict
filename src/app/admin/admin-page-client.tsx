'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GROUPS, getTeamById } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { toast } from 'sonner'
import {
  saveGroupResult,
  triggerRecalculate,
  triggerApiSync,
  getAdminStats,
} from '@/app/actions/admin'
import { TeamFlag } from '@/components/team-flag'

export function AdminPageClient() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [results, setResults] = useState<
    Record<number, { scoreA: string; scoreB: string }>
  >({})
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [stats, setStats] = useState<{
    totalUsers: number
    totalSubmissions: number
    groupResultsEntered: number
    knockoutResultsEntered: number
    pools: Array<{ id: string; name: string; slug: string; members: number; submissions: number }>
  }>({
    totalUsers: 0,
    totalSubmissions: 0,
    groupResultsEntered: 0,
    knockoutResultsEntered: 0,
    pools: [],
  })

  const matches = getMatchesByGroup(selectedGroup)

  useEffect(() => {
    getAdminStats().then(setStats).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to load admin stats')
    })
  }, [])

  const handleResultChange = (
    matchId: number,
    side: 'A' | 'B',
    value: string,
  ) => {
    setResults((prev) => ({
      ...prev,
      [matchId]: {
        scoreA: side === 'A' ? value : (prev[matchId]?.scoreA ?? ''),
        scoreB: side === 'B' ? value : (prev[matchId]?.scoreB ?? ''),
      },
    }))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    let saved = 0
    let errors = 0

    for (const match of matches) {
      const result = results[match.id]
      if (!result || result.scoreA === '' || result.scoreB === '') continue

      const scoreA = parseInt(result.scoreA)
      const scoreB = parseInt(result.scoreB)
      if (isNaN(scoreA) || isNaN(scoreB)) continue

      const res = await saveGroupResult(match.id, scoreA, scoreB)
      if (res.success) {
        saved++
      } else {
        errors++
        toast.error(`Match ${match.id}: ${res.error}`)
      }
    }

    setSaving(false)
    if (saved > 0) toast.success(`Saved ${saved} result(s)`)
    if (errors > 0) toast.error(`${errors} result(s) failed`)

    getAdminStats().then(setStats).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh admin stats')
    })
  }

  const handleApiSync = async () => {
    setSyncing(true)
    const res = await triggerApiSync()
    setSyncing(false)

    if (res.success) {
      const d = res.data as { groupSynced?: number; knockoutSynced?: number } | undefined
      toast.success(
        `Synced: ${d?.groupSynced ?? 0} group, ${d?.knockoutSynced ?? 0} knockout`,
      )
      getAdminStats().then(setStats).catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to refresh admin stats')
      })
    } else {
      toast.error(res.error ?? 'Sync failed')
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    const res = await triggerRecalculate()
    setRecalculating(false)

    if (res.success) {
      toast.success(`Recalculated scores for ${res.usersScored} user(s)`)
    } else {
      toast.error(res.error ?? 'Recalculation failed')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage results, sync from API, and recalculate scores.
          </p>
        </div>
        <Badge variant="secondary">Admin</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Tournament Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Registered Users</span>
              <span>{stats.totalUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Submissions</span>
              <span>{stats.totalSubmissions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Group Results</span>
              <span>{stats.groupResultsEntered}/72</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Knockout Results</span>
              <span>{stats.knockoutResultsEntered}/32</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleApiSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync from API'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Pools</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active pools.</p>
          ) : (
            <div className="space-y-2">
              {stats.pools.map((pool) => (
                <div
                  key={pool.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/30 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{pool.name}</p>
                    <p className="text-xs text-muted-foreground">{pool.slug}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>
                      <span className="text-muted-foreground">Members</span>{' '}
                      <span className="font-bold">{pool.members}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Submissions</span>{' '}
                      <span className="font-bold">{pool.submissions}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Enter Match Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                  selectedGroup === group
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {matches.map((match) => {
              const teamA = getTeamById(match.teamAId)
              const teamB = getTeamById(match.teamBId)
              const result = results[match.id]

              return (
                <div
                  key={match.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/30"
                >
                  <div className="flex-1 flex items-center justify-end gap-2">
                    <span className="text-sm">{teamA.name}</span>
                    <TeamFlag team={teamA} size={18} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={result?.scoreA ?? ''}
                      onChange={(e) =>
                        handleResultChange(match.id, 'A', e.target.value)
                      }
                      placeholder="-"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={result?.scoreB ?? ''}
                      onChange={(e) =>
                        handleResultChange(match.id, 'B', e.target.value)
                      }
                      placeholder="-"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <TeamFlag team={teamB} size={18} />
                    <span className="text-sm">{teamB.name}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleSaveAll} disabled={saving}>
              {saving ? 'Saving...' : 'Save Results'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
