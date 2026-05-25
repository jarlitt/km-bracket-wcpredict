import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const GROUP_MATCH_RULES = [
  { rule: 'Correct match result (Win / Draw)', points: 3 },
  { rule: 'Exact scoreline bonus', points: '+2' },
]

const GROUP_POSITION_RULES = [
  { position: '1st place', points: '+4' },
  { position: '2nd place', points: '+3' },
  { position: '3rd place', points: '+2' },
]

const KNOCKOUT_RULES = [
  { round: 'Round of 32', points: 2 },
  { round: 'Round of 16', points: 4 },
  { round: 'Quarter-finals', points: 6 },
  { round: 'Semi-finals', points: 8 },
  { round: 'Third-place match', points: 5 },
  { round: 'Final', points: 15 },
]

export default function RulesPage() {
  return (
    <div className="gradient-bg min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Scoring Rules
        </h1>
        <p className="mb-10 text-muted-foreground">
          Understand how points are awarded throughout the tournament.
        </p>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="text-xl">📊</span>
                Group Stage Scoring
              </CardTitle>
              <CardDescription>
                Points earned per match prediction (72 matches total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {GROUP_MATCH_RULES.map((item) => (
                  <div
                    key={item.rule}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
                  >
                    <span className="text-sm">{item.rule}</span>
                    <Badge variant="secondary" className="font-semibold">
                      {item.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                <strong>Maximum per match:</strong> 5 points (3 for correct
                result + 2 exact scoreline bonus).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="text-xl">🏅</span>
                Group Position Bonus
              </CardTitle>
              <CardDescription>
                Bonus points for correctly predicting final group standings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {GROUP_POSITION_RULES.map((item) => (
                  <div
                    key={item.position}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
                  >
                    <span className="text-sm">{item.position} in group</span>
                    <Badge variant="secondary" className="font-semibold">
                      {item.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                <strong>Maximum per group:</strong> 9 points. With 12 groups,
                that&apos;s up to 108 bonus points total.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                Knockout Stage Scoring
              </CardTitle>
              <CardDescription>
                Points increase as the tournament progresses — reward for bold,
                correct predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {KNOCKOUT_RULES.map((item) => (
                  <div
                    key={item.round}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
                  >
                    <span className="text-sm">{item.round}</span>
                    <Badge variant="secondary" className="font-semibold">
                      {item.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
