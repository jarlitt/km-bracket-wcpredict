# Homepage Content Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal homepage with a content-rich, state-adaptive page that creates urgency and surfaces live data (leaderboard, participation, matches).

**Architecture:** The homepage `page.tsx` becomes a server component that fetches leaderboard, participation, and match data. Interactive sections (countdown, leaderboard tabs, hero CTA) are client islands. Content adapts based on user state (anonymous/started/submitted) and tournament state (pre-kickoff/live).

**Tech Stack:** Next.js App Router, React Server Components, Supabase, Tailwind CSS, shadcn/ui components, existing auth/predictions context.

---

### Task 1: CountdownTimer Component

**Files:**
- Create: `src/components/home/countdown-timer.tsx`

- [ ] **Step 1: Create the CountdownTimer client component**

Create `src/components/home/countdown-timer.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  lockAt: string // ISO date string
}

function computeTimeLeft(lockAt: Date) {
  const diff = Math.max(0, lockAt.getTime() - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    expired: diff === 0,
  }
}

export function CountdownTimer({ lockAt }: CountdownTimerProps) {
  const lockDate = new Date(lockAt)
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(lockDate))

  useEffect(() => {
    if (timeLeft.expired) return
    const id = setInterval(() => {
      const next = computeTimeLeft(lockDate)
      setTimeLeft(next)
      if (next.expired) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [lockDate, timeLeft.expired])

  if (timeLeft.expired) return null

  const units = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Min' },
  ]

  return (
    <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-border/40 bg-card/30 px-5 py-3">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3">
          {i > 0 && <span className="text-lg text-muted-foreground/40">:</span>}
          <div className="text-center">
            <div className="text-2xl font-extrabold tabular-nums">{String(unit.value).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{unit.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders without errors**

Run: `npx next build 2>&1 | head -30` (or start dev server and navigate — this component isn't mounted yet, but checking for syntax/import errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/countdown-timer.tsx
git commit -m "feat(home): add CountdownTimer client component"
```

---

### Task 2: ParticipationBanner Component

**Files:**
- Create: `src/components/home/participation-banner.tsx`

- [ ] **Step 1: Create the ParticipationBanner server component**

Create `src/components/home/participation-banner.tsx`:

```tsx
import { PoolFlag } from '@/components/pools/pool-flag'

interface OfficeCount {
  slug: string
  name: string
  count: number
}

interface ParticipationBannerProps {
  totalSubmitted: number
  officeCounts: OfficeCount[]
}

export function ParticipationBanner({ totalSubmitted, officeCounts }: ParticipationBannerProps) {
  if (totalSubmitted === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 border-b border-primary/10 bg-primary/[0.04] px-6 py-3 sm:gap-6">
      <div className="flex items-center gap-2">
        <span className="text-xl font-extrabold text-primary">{totalSubmitted}</span>
        <span className="text-xs text-muted-foreground leading-tight">
          players<br />submitted
        </span>
      </div>

      <div className="hidden h-6 w-px bg-border/40 sm:block" />

      <div className="flex flex-wrap gap-1.5">
        {officeCounts.map((office) => (
          <span
            key={office.slug}
            className="flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            <PoolFlag slug={office.slug} size={14} />
            {office.name.replace(' Office', '')}
            <span className="font-bold text-foreground">{office.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/participation-banner.tsx
git commit -m "feat(home): add ParticipationBanner component"
```

---

### Task 3: PreviewCards Component

**Files:**
- Create: `src/components/home/preview-cards.tsx`

- [ ] **Step 1: Create the PreviewCards client component**

Create `src/components/home/preview-cards.tsx`. This is a static visual component — no data fetching. It shows three cards with illustrative visuals of the app's core features.

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function GroupPreviewVisual() {
  const rows = [
    { flagA: '🇲🇽', codeA: 'MEX', flagB: '🇿🇦', codeB: 'RSA', filled: true },
    { flagA: '🇰🇷', codeA: 'KOR', flagB: '🇨🇿', codeB: 'CZE', filled: false },
    { flagA: '🇨🇿', codeA: 'CZE', flagB: '🇿🇦', codeB: 'RSA', filled: false },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{r.flagA}</span>
          <span className="w-7">{r.codeA}</span>
          <span className={`flex h-5 w-5 items-center justify-center rounded border text-[9px] font-bold ${r.filled ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/40 bg-card/50'}`}>
            {r.filled ? '2' : ''}
          </span>
          <span className="text-muted-foreground/40">–</span>
          <span className={`flex h-5 w-5 items-center justify-center rounded border text-[9px] font-bold ${r.filled ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/40 bg-card/50'}`}>
            {r.filled ? '1' : ''}
          </span>
          <span className="w-7 text-right">{r.codeB}</span>
          <span>{r.flagB}</span>
        </div>
      ))}
    </div>
  )
}

function BracketPreviewVisual() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1.5">
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇧🇷 BRA</span>
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇰🇷 KOR</span>
        <div className="h-2" />
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇫🇷 FRA</span>
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇯🇵 JPN</span>
      </div>
      <div className="flex flex-col items-center gap-6">
        <div className="h-px w-3 bg-border/40" />
        <div className="h-px w-3 bg-border/40" />
      </div>
      <div className="flex flex-col gap-7">
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇧🇷 BRA</span>
        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">🇫🇷 FRA</span>
      </div>
      <div className="flex items-center">
        <div className="h-px w-3 bg-border/40" />
      </div>
      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">🏆 BRA</span>
    </div>
  )
}

function LeaderboardPreviewVisual() {
  const rows = [
    { rank: 1, name: 'Carlos M.', pts: 248, pct: 100, color: 'bg-emerald-500' },
    { rank: 2, name: 'Sarah K.', pts: 231, pct: 93, color: 'bg-primary' },
    { rank: 3, name: 'Marc D.', pts: 219, pct: 88, color: 'bg-primary' },
    { rank: 4, name: 'You', pts: 198, pct: 80, color: 'bg-primary/50' },
  ]
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.rank} className="flex items-center gap-1.5 text-[9px]">
          <span className={`w-3 font-bold ${r.rank <= 3 ? 'text-amber-400' : 'text-muted-foreground'}`}>{r.rank}</span>
          <span className={`flex-1 ${r.name === 'You' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{r.name}</span>
          <span className="font-bold text-emerald-400">{r.pts}</span>
          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted/30">
            <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const CARDS = [
  {
    title: 'Group Predictions',
    description: 'Predict the score of all 72 group-stage matches across 12 groups.',
    Visual: GroupPreviewVisual,
  },
  {
    title: 'Knockout Bracket',
    description: 'Your group scores auto-generate a unique bracket. Pick winners to the final.',
    Visual: BracketPreviewVisual,
  },
  {
    title: 'Live Leaderboard',
    description: 'Watch your score climb as real results come in. Climb the global ranking.',
    Visual: LeaderboardPreviewVisual,
  },
]

export function PreviewCards() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-6 text-center text-[10px] font-bold uppercase tracking-[3px] text-muted-foreground/60">
        What You&apos;ll Be Doing
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Card key={card.title} className="glass-card border-0 overflow-hidden">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/[0.06] to-emerald-500/[0.03] px-4">
              <card.Visual />
            </div>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/preview-cards.tsx
git commit -m "feat(home): add PreviewCards component with visual illustrations"
```

---

### Task 4: HomeLeaderboard Component

**Files:**
- Create: `src/components/home/home-leaderboard.tsx`

- [ ] **Step 1: Create the HomeLeaderboard client component**

This component receives server-fetched data and handles tab switching client-side. It shows top 10 + "You" row.

Create `src/components/home/home-leaderboard.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PoolFlag } from '@/components/pools/pool-flag'
import type { GlobalPlayer, CountryStanding } from '@/lib/leaderboard/aggregate'

interface HomeLeaderboardProps {
  players: GlobalPlayer[]
  countries: CountryStanding[]
  currentUserId?: string
  locked: boolean
}

export function HomeLeaderboard({ players, countries, currentUserId, locked }: HomeLeaderboardProps) {
  const [activeTab, setActiveTab] = useState('global')

  const tabs = useMemo(() => {
    const countryTabs = countries.map((c) => ({ id: c.slug, label: c.name.replace(' Office', ''), slug: c.slug }))
    return [{ id: 'global', label: 'Global', slug: '' }, ...countryTabs]
  }, [countries])

  const filtered = useMemo(() => {
    if (activeTab === 'global') return players
    return players.filter((p) => p.country === activeTab)
  }, [activeTab, players])

  const top10 = filtered.slice(0, 10)
  const currentUser = currentUserId ? filtered.find((p) => p.userId === currentUserId) : null
  const currentUserInTop10 = currentUser ? top10.some((p) => p.userId === currentUserId) : false

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[3px] text-muted-foreground/60">
        Leaderboard
      </p>

      <div className="flex gap-0 overflow-x-auto border-b border-border/40 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.slug && <PoolFlag slug={tab.slug} size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {top10.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No players yet.</p>
        ) : (
          <>
            {top10.map((player) => (
              <LeaderboardRow
                key={player.userId}
                player={player}
                isOwn={player.userId === currentUserId}
              />
            ))}
            {currentUser && !currentUserInTop10 && (
              <div className="border-t border-dashed border-border/30">
                <LeaderboardRow player={currentUser} isOwn />
              </div>
            )}
            {!currentUserId && (
              <div className="border-t border-dashed border-border/30 px-4 py-3 text-center text-xs text-muted-foreground">
                Sign up to join the leaderboard
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-center">
        <Link href="/leaderboard" className="text-xs text-primary hover:underline">
          View full leaderboard →
        </Link>
      </p>
    </section>
  )
}

function LeaderboardRow({ player, isOwn }: { player: GlobalPlayer; isOwn: boolean }) {
  const rankColor =
    player.rank === 1 ? 'text-amber-400' :
    player.rank === 2 ? 'text-slate-400' :
    player.rank === 3 ? 'text-amber-600' :
    'text-muted-foreground'

  return (
    <div
      className={`flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-b-0 text-sm ${
        isOwn ? 'bg-primary/[0.06]' : ''
      }`}
    >
      <span className={`w-6 text-right text-xs font-bold ${rankColor}`}>
        {player.rank}
      </span>
      <PoolFlag slug={player.country} size={20} />
      <span className={`flex-1 font-medium ${isOwn ? 'text-primary' : ''}`}>
        {isOwn ? 'You' : player.displayName}
        {isOwn && !player.submitted && (
          <span className="ml-1.5 text-[10px] text-primary/70">(not submitted)</span>
        )}
        {isOwn && player.submitted && player.totalScore === 0 && (
          <span className="ml-1.5 text-[10px] text-primary/70">✓ submitted</span>
        )}
      </span>
      <span className={`text-sm font-bold ${player.totalScore > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
        {player.totalScore > 0 ? player.totalScore : '—'}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/home-leaderboard.tsx
git commit -m "feat(home): add HomeLeaderboard component with tab switching"
```

---

### Task 5: UpcomingMatches Component

**Files:**
- Create: `src/components/home/upcoming-matches.tsx`

- [ ] **Step 1: Create the UpcomingMatches component**

This is a client component because it uses `useLocalKickoff` for timezone conversion.

Create `src/components/home/upcoming-matches.tsx`:

```tsx
'use client'

import { useLocalKickoff } from '@/lib/format-kickoff'
import { getTeamById } from '@/lib/data/teams'
import type { GroupMatch } from '@/types'

interface UpcomingMatchesProps {
  matches: GroupMatch[]
  locked: boolean
}

export function UpcomingMatches({ matches, locked }: UpcomingMatchesProps) {
  if (matches.length === 0) return null

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[3px] text-muted-foreground/60">
        {locked ? "Today's Matches" : 'First Matches'}
      </p>
      <div className="flex flex-col gap-2">
        {matches.map((match) => (
          <MatchRow key={match.id} match={match} />
        ))}
      </div>
    </section>
  )
}

function MatchRow({ match }: { match: GroupMatch }) {
  const teamA = getTeamById(match.teamAId)
  const teamB = getTeamById(match.teamBId)
  const local = useLocalKickoff(match.date, match.time)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/30 px-4 py-3">
      <div className="min-w-14 text-center">
        <div className="text-xs font-bold">{local?.date ?? match.date}</div>
        <div className="text-[10px] text-muted-foreground">{local?.time ?? match.time}</div>
      </div>
      <div className="flex flex-1 items-center gap-2 text-xs font-semibold">
        <span>{teamA.flag}</span>
        <span>{teamA.name}</span>
        <span className="text-muted-foreground/40">vs</span>
        <span>{teamB.name}</span>
        <span>{teamB.flag}</span>
      </div>
      <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        Group {match.groupId}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/upcoming-matches.tsx
git commit -m "feat(home): add UpcomingMatches component"
```

---

### Task 6: HeroSection Component

**Files:**
- Create: `src/components/home/hero-section.tsx`
- Modify: `src/components/home/dashboard-section.tsx` (will be replaced)

- [ ] **Step 1: Create the HeroSection client component**

This replaces `HeroCta` and adds the full adaptive hero content (headline, tagline, countdown, CTA). It reads user/prediction state from context, same as the current `HeroCta`.

Create `src/components/home/hero-section.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CountdownTimer } from '@/components/home/countdown-timer'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32
const TOTAL_MATCHES = TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES

interface HeroSectionProps {
  lockAt: string
  locked: boolean
}

export function HeroSection({ lockAt, locked }: HeroSectionProps) {
  const { user, loading: authLoading } = useAuth()
  const { submitted, groupPredictions, totalGroupPredictions, totalKnockoutPredictions, dbLoaded } = usePredictions()

  const started = Object.keys(groupPredictions).length > 0
  const totalPredictions = totalGroupPredictions + totalKnockoutPredictions
  const overallProgress = Math.round((totalPredictions / TOTAL_MATCHES) * 100)

  let kicker = 'FIFA World Cup 2026'
  let headline: React.ReactNode = <>Think you know football?<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Prove it.</span></>
  let tagline = '104 matches. One bracket. Zero excuses.'
  let showCountdown = !locked
  let cta: React.ReactNode

  if (locked) {
    kicker = 'TOURNAMENT IN PROGRESS'
    headline = <>The game is <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">on.</span></>
    tagline = 'Watch your predictions play out in real time.'
    showCountdown = false
    cta = (
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/matches" className={buttonVariants({ size: 'lg', className: 'bg-red-600 hover:bg-red-700 px-6 text-base' })}>
          Live Scores
        </Link>
        <Link href="/leaderboard" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-6 text-base' })}>
          View Leaderboard
        </Link>
      </div>
    )
  } else if (authLoading || !dbLoaded) {
    cta = (
      <div className="mt-8 flex gap-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
          Start Predicting
        </Link>
        <Link href="/rules" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}>
          View Rules
        </Link>
      </div>
    )
  } else if (user && submitted) {
    headline = <>You&apos;re in.<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Now we wait.</span></>
    tagline = 'Predictions locked and loaded. Edit anytime before kickoff.'
    cta = (
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/predict/groups" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-6 text-base' })}>
          Edit Predictions
        </Link>
        <Link href="/leaderboard" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-6 text-base' })}>
          View Leaderboard
        </Link>
      </div>
    )
  } else if (user && started) {
    headline = <>You&apos;ve started.<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Now finish.</span></>
    tagline = "Don't leave your bracket half-done."
    cta = (
      <div className="mt-8 w-full max-w-sm space-y-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'w-full px-8 text-base' })}>
          Continue Predicting
        </Link>
        <div className="flex items-center gap-3">
          <Progress
            value={overallProgress}
            className="flex-1 h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <span className="text-xs text-emerald-400 whitespace-nowrap">
            {totalPredictions}/{TOTAL_MATCHES}
          </span>
        </div>
      </div>
    )
  } else {
    cta = (
      <div className="mt-8 flex gap-4">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
          Start Predicting
        </Link>
        <Link href="/rules" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8 text-base' })}>
          View Rules
        </Link>
      </div>
    )
  }

  return (
    <section className="flex flex-col items-center justify-center px-4 pb-12 pt-20 text-center md:pt-28">
      <p className={`mb-4 text-sm font-medium uppercase tracking-widest ${locked ? 'text-emerald-400' : 'text-muted-foreground'}`}>
        {kicker}
      </p>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
        {headline}
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        {tagline}
      </p>
      {showCountdown && <CountdownTimer lockAt={lockAt} />}
      {cta}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/hero-section.tsx
git commit -m "feat(home): add HeroSection with adaptive content and countdown"
```

---

### Task 7: ClosingCta Component

**Files:**
- Create: `src/components/home/closing-cta.tsx`

- [ ] **Step 1: Create the ClosingCta client component**

Create `src/components/home/closing-cta.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const TOTAL_MATCHES = 72 + 32

interface ClosingCtaProps {
  locked: boolean
}

export function ClosingCta({ locked }: ClosingCtaProps) {
  const { user } = useAuth()
  const { submitted, groupPredictions, totalGroupPredictions, totalKnockoutPredictions } = usePredictions()

  if (locked || submitted) return null

  const started = Object.keys(groupPredictions).length > 0
  const totalPredictions = totalGroupPredictions + totalKnockoutPredictions
  const pct = Math.round((totalPredictions / TOTAL_MATCHES) * 100)

  const headline = started
    ? `${pct}% isn't gonna cut it.`
    : 'Still on the bench?'
  const tagline = started
    ? 'Complete your predictions before kickoff.'
    : "Predictions lock at kickoff. Don't be that person."
  const ctaLabel = started ? 'Continue Predicting' : 'Start Predicting'

  return (
    <section className="px-4 py-12 text-center">
      <h2 className="text-xl font-bold md:text-2xl">{headline}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
      <div className="mt-6">
        <Link href="/predict/groups" className={buttonVariants({ size: 'lg', className: 'px-8 text-base' })}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/closing-cta.tsx
git commit -m "feat(home): add ClosingCta component with adaptive copy"
```

---

### Task 8: Homepage Data Fetching + Assembly

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/home/dashboard-section.tsx` (delete old `HeroCta` export or keep for backward compat)

- [ ] **Step 1: Rewrite `src/app/page.tsx` as a server component with data fetching**

Replace the entire content of `src/app/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTournamentLockAt } from '@/lib/matches/lock-server'
import { isTournamentLockedAsync } from '@/lib/matches/lock-server'
import { aggregateLeaderboard } from '@/lib/leaderboard/aggregate'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { HeroSection } from '@/components/home/hero-section'
import { ParticipationBanner } from '@/components/home/participation-banner'
import { PreviewCards } from '@/components/home/preview-cards'
import { HomeLeaderboard } from '@/components/home/home-leaderboard'
import { UpcomingMatches } from '@/components/home/upcoming-matches'
import { ClosingCta } from '@/components/home/closing-cta'

export default async function HomePage() {
  const supabase = await createClient()
  const lockAt = await getTournamentLockAt()
  const locked = await isTournamentLockedAsync()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: scores }, { data: profiles }, { data: pools }, { data: submissions }] = await Promise.all([
    supabase.from('user_scores').select('user_id, pool_id, total_score'),
    supabase.from('profiles').select('id, display_name, country'),
    supabase.from('pools').select('id, slug, name').eq('is_active', true),
    supabase.from('submissions').select('user_id, pool_id'),
  ])

  const { countryStandings, globalPlayers } = aggregateLeaderboard(
    scores ?? [],
    profiles ?? [],
    pools ?? [],
    submissions ?? [],
  )

  // Participation counts per office
  const officeCounts = countryStandings.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: c.memberCount,
  }))
  const totalSubmitted = officeCounts.reduce((sum, o) => sum + o.count, 0)

  // First 4 matches for the upcoming section
  const upcomingMatches = GROUP_MATCHES
    .filter((m) => m.date && m.time)
    .slice(0, 4)

  return (
    <div className="gradient-bg min-h-screen">
      <HeroSection lockAt={lockAt.toISOString()} locked={locked} />

      <ParticipationBanner totalSubmitted={totalSubmitted} officeCounts={officeCounts} />

      <PreviewCards />

      <HomeLeaderboard
        players={globalPlayers}
        countries={countryStandings}
        currentUserId={user?.id}
        locked={locked}
      />

      <UpcomingMatches matches={upcomingMatches} locked={locked} />

      <ClosingCta locked={locked} />

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>World Cup 2026 Predictor — Built for the beautiful game</p>
      </footer>
    </div>
  )
}
```

**Note:** The `PreviewCards` component needs to be conditionally rendered based on user prediction state. Since that state comes from the client-side `usePredictions()` context, we can't do this from the server component. Instead, the `PreviewCards` component should internally read the context and self-hide. Update `preview-cards.tsx` — wrap the return in a check:

Add to the top of the `PreviewCards` function body:

```tsx
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

export function PreviewCards() {
  const { user } = useAuth()
  const { groupPredictions, submitted } = usePredictions()
  const started = Object.keys(groupPredictions).length > 0

  if (user && (started || submitted)) return null

  // ... rest of component
}
```

- [ ] **Step 2: Run the dev server and verify the homepage loads**

Run: `npm run dev`

Open `http://localhost:3000` in a browser. Verify:
- Hero section renders with countdown
- Participation banner shows (if any submissions exist)
- Preview cards show for anonymous users
- Leaderboard section renders with tabs
- Upcoming matches show first 4 matches
- Closing CTA shows for non-submitted users
- Footer is present

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/home/preview-cards.tsx
git commit -m "feat(home): assemble new homepage with all sections"
```

---

### Task 9: Clean Up Old Code

**Files:**
- Modify: `src/components/home/dashboard-section.tsx`

- [ ] **Step 1: Remove or simplify `dashboard-section.tsx`**

The old `HeroCta` export is no longer used by `page.tsx`. Check if anything else imports it:

Run: `rg 'HeroCta|dashboard-section' src/ --type ts --type tsx`

If nothing else imports `HeroCta`, delete the file:

```bash
rm src/components/home/dashboard-section.tsx
```

If something else does import it, keep the file but add a deprecation comment.

- [ ] **Step 2: Run the build to verify no broken imports**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no import errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(home): remove unused HeroCta/dashboard-section"
```

---

### Task 10: Responsive Polish + Visual Verification

**Files:**
- Potentially modify any of the new `src/components/home/*.tsx` files

- [ ] **Step 1: Check mobile layout**

Open the dev server at `http://localhost:3000` and use browser dev tools to test at 375px (mobile) and 768px (tablet) widths. Verify:
- Countdown digits don't overflow on mobile
- Preview cards stack vertically on mobile (grid should collapse from 3-col to 1-col)
- Leaderboard tabs scroll horizontally on mobile
- Match rows don't overflow
- Participation banner pills wrap properly

- [ ] **Step 2: Fix any layout issues found**

Apply responsive fixes as needed. Common patterns:
- Ensure `flex-wrap` is present on the participation pills
- Ensure leaderboard tabs have `overflow-x-auto`
- Preview cards grid: `grid gap-4 sm:grid-cols-3` handles responsive
- Match rows: `flex-wrap` on the teams area if names are long

- [ ] **Step 3: Run linter check**

Run: `npx next lint`

Fix any linter warnings introduced by the new components.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(home): responsive layout and linter fixes"
```

---

### Task 11: Final Build Verification

- [ ] **Step 1: Run a full production build**

Run: `npm run build`

Expected: Build succeeds. No type errors, no missing imports.

- [ ] **Step 2: Run existing tests**

Run: `npm test 2>&1 | tail -20`

Expected: All existing tests pass. No regressions.

- [ ] **Step 3: Manual smoke test all 4 states**

1. **Anonymous:** Open homepage in incognito. Verify: challenge headline, countdown, preview cards, leaderboard with "Sign up to join", upcoming matches, closing CTA.
2. **Started predicting:** Log in, add some group predictions but don't submit. Verify: "You've started. Now finish.", progress bar, no preview cards, leaderboard with "You (not submitted)", closing CTA with progress percentage.
3. **Submitted:** Submit predictions. Verify: "You're in. Now we wait.", Edit/Leaderboard buttons, leaderboard with "You ✓ submitted", no closing CTA.
4. **Tournament live:** (Can test by temporarily setting `lock_at` in `tournament_settings` to a past date). Verify: "The game is on.", Live Scores button, no countdown, leaderboard with scores.

- [ ] **Step 4: Final commit if any remaining fixes**

```bash
git add -A
git commit -m "chore(home): final homepage verification and cleanup"
```
