'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'You', score: 0, groupPts: 0, knockoutPts: 0, isCurrentUser: true },
]

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track scores and rankings once the tournament begins.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Your Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">--</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Group Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Knockout Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
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
              {MOCK_LEADERBOARD.map(player => (
                <TableRow key={player.rank} className="border-border/20">
                  <TableCell className="text-center font-bold">{player.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      {player.isCurrentUser && (
                        <Badge variant="secondary" className="text-[10px]">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">{player.groupPts}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{player.knockoutPts}</TableCell>
                  <TableCell className="text-center font-bold">{player.score}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-border/20">
                <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                  Scores will be calculated once the tournament begins and results are entered.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
