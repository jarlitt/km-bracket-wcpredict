import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DashboardSection } from '@/components/home/dashboard-section'

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

export default function HomePage() {
  return (
    <div className="gradient-bg min-h-screen">
      <section className="flex flex-col items-center justify-center px-4 pb-16 pt-20 text-center md:pt-28">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          FIFA World Cup 2026
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          World Cup 2026{' '}
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

      <DashboardSection />

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

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>World Cup 2026 Predictor — Built for the beautiful game</p>
      </footer>
    </div>
  )
}
