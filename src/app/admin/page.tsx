'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GROUPS, getTeamsByGroup, getTeamById } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { toast } from 'sonner'

export default function AdminPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [results, setResults] = useState<Record<number, { scoreA: number; scoreB: number }>>({})

  const matches = getMatchesByGroup(selectedGroup)

  const handleResultChange = (matchId: number, side: 'A' | 'B', value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, parseInt(value) || 0)
    setResults(prev => ({
      ...prev,
      [matchId]: {
        scoreA: side === 'A' ? numValue : (prev[matchId]?.scoreA ?? 0),
        scoreB: side === 'B' ? numValue : (prev[matchId]?.scoreB ?? 0),
      },
    }))
  }

  const handleSave = () => {
    toast.success('Results saved (local only). Connect Supabase for persistence.')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter actual match results to calculate scores.
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
              <span className="text-muted-foreground">Phase</span>
              <span>Pre-Tournament</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Predictions</span>
              <span>Open</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Matches Played</span>
              <span>0/104</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled>Lock Predictions</Button>
            <Button variant="outline" size="sm" disabled>Recalculate Scores</Button>
            <Button variant="outline" size="sm" disabled>Export Data</Button>
            <Button variant="outline" size="sm" disabled>API Sync</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Enter Match Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {GROUPS.map(group => (
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
            {matches.map(match => {
              const teamA = getTeamById(match.teamAId)
              const teamB = getTeamById(match.teamBId)
              const result = results[match.id]

              return (
                <div key={match.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/30 border border-border/30">
                  <div className="flex-1 text-right">
                    <span className="text-sm">{teamA.flag} {teamA.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={result?.scoreA ?? ''}
                      onChange={e => handleResultChange(match.id, 'A', e.target.value)}
                      placeholder="-"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-12 h-9 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={result?.scoreB ?? ''}
                      onChange={e => handleResultChange(match.id, 'B', e.target.value)}
                      placeholder="-"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm">{teamB.name} {teamB.flag}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleSave}>Save Results</Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-amber-400 mb-1">Supabase Required</p>
        <p>
          To persist results and calculate scores for all users, configure your Supabase
          environment variables in <code className="text-xs bg-muted/30 px-1 rounded">.env.local</code>.
        </p>
      </div>
    </div>
  )
}
