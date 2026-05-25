import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PredictionBanner } from '@/components/prediction/prediction-banner'

const FEATURES = [
  {
    icon: '📝',
    title: 'Predict All Matches',
    description:
      'Enter your predicted scores for all 72 group-stage matches across 12 groups.',
  },
  {
    icon: '🏆',
    title: 'Auto-Generated Bracket',
    description:
      'Your group predictions automatically generate a unique knockout bracket for you to complete.',
  },
  {
    icon: '⚡',
    title: 'Live Scoring',
    description:
      'Earn points as real results come in. Track your score and climb the leaderboard.',
  },
]

const SCORING_ROWS = [
  { category: 'Group Stage', rule: 'Correct result (W/D/L)', points: '3 pts' },
  { category: 'Group Stage', rule: 'Exact scoreline bonus', points: '+2 pts' },
  { category: 'Group Position', rule: '1st place correct', points: '+4 pts' },
  { category: 'Group Position', rule: '2nd place correct', points: '+3 pts' },
  { category: 'Group Position', rule: '3rd place correct', points: '+2 pts' },
  { category: 'Knockout', rule: 'Round of 32 winner', points: '2 pts' },
  { category: 'Knockout', rule: 'Round of 16 winner', points: '4 pts' },
  { category: 'Knockout', rule: 'Quarter-final winner', points: '6 pts' },
  { category: 'Knockout', rule: 'Semi-final winner', points: '8 pts' },
  { category: 'Knockout', rule: '3rd place match winner', points: '5 pts' },
  { category: 'Knockout', rule: 'Final winner', points: '15 pts' },
]

export default function HomePage() {
  return (
    <div className="gradient-bg min-h-screen">
      <PredictionBanner />
      <section className="flex flex-col items-center justify-center px-4 pb-20 pt-24 text-center md:pt-32">
        <Image src="/km-logo.png" alt="KingMakers" width={48} height={48} className="mb-4" />
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          FIFA World Cup 2026
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          KingMakers World Cup 2026{' '}
          <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Predictor
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Predict every match. Climb the leaderboard. Prove you know football.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/predict/groups"
            className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}
          >
            Start Predicting
          </Link>
          <Link
            href="/rules"
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}
          >
            View Rules
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="glass-card border-0">
              <CardHeader>
                <div className="mb-2 text-3xl">{feature.icon}</div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-24">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">
          Scoring System
        </h2>
        <Card className="glass-card border-0">
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {SCORING_ROWS.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <span className="mr-3 inline-block rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {row.category}
                    </span>
                    <span className="text-sm">{row.rule}</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-400">
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>KingMakers WC2026 Predictor — Built for the beautiful game</p>
      </footer>
    </div>
  )
}
