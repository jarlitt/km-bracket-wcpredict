'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

function GroupPreviewVisual() {
  const rows: { a: string; b: string; sA?: string; sB?: string }[] = [
    { a: 'MEX', b: 'RSA', sA: '2', sB: '1' },
    { a: 'KOR', b: 'CZE' },
    { a: 'CZE', b: 'RSA' },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div
          key={`${r.a}-${r.b}`}
          className="flex items-center justify-between gap-2 text-[10px] font-medium"
        >
          <span className="w-8 text-right">{r.a}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded border border-white/20 bg-white/10 text-[9px] tabular-nums">
            {r.sA ?? ''}
          </span>
          <span className="text-muted-foreground">–</span>
          <span className="flex h-5 w-5 items-center justify-center rounded border border-white/20 bg-white/10 text-[9px] tabular-nums">
            {r.sB ?? ''}
          </span>
          <span className="w-8">{r.b}</span>
        </div>
      ))}
    </div>
  )
}

function BracketPreviewVisual() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-12 rounded border border-white/20 bg-white/10" />
        <div className="h-4 w-12 rounded border border-white/20 bg-white/10" />
      </div>
      <div className="flex flex-col items-center">
        <div className="h-px w-3 bg-white/20" />
        <div className="h-8 w-px bg-white/20" />
        <div className="h-px w-3 bg-white/20" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="h-5 w-14 rounded border border-indigo-400/30 bg-indigo-500/20" />
        <span className="text-[8px] text-indigo-300">🏆</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="h-px w-3 bg-white/20" />
        <div className="h-8 w-px bg-white/20" />
        <div className="h-px w-3 bg-white/20" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-12 rounded border border-white/20 bg-white/10" />
        <div className="h-4 w-12 rounded border border-white/20 bg-white/10" />
      </div>
    </div>
  )
}

function LeaderboardPreviewVisual() {
  const bars = [85, 72, 60]
  return (
    <div className="flex flex-col gap-2">
      {bars.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 text-[9px] font-bold text-muted-foreground">
            {i + 1}
          </span>
          <div className="h-3 rounded-full bg-indigo-500/30" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

const CARDS = [
  {
    title: 'Group Predictions',
    description:
      'Predict the score of all 72 group-stage matches across 12 groups.',
    visual: GroupPreviewVisual,
  },
  {
    title: 'Knockout Bracket',
    description:
      'Your group scores auto-generate a unique bracket. Pick winners to the final.',
    visual: BracketPreviewVisual,
  },
  {
    title: 'Live Leaderboard',
    description:
      'Watch your score climb as real results come in. Climb the global ranking.',
    visual: LeaderboardPreviewVisual,
  },
] as const

export function PreviewCards() {
  const { user } = useAuth()
  const { groupPredictions, submitted } = usePredictions()

  const started = Object.keys(groupPredictions).length > 0
  if ((user && started) || submitted) return null

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">What You&apos;ll Be Doing</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Card key={card.title} className="overflow-hidden border-border/40">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-950/60 to-slate-950/60">
              <card.visual />
            </div>
            <CardHeader>
              <CardTitle className="text-sm">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="-mt-2">
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
