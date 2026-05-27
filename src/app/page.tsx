import { HeroSection } from '@/components/home/hero-section'
import { ParticipationBanner } from '@/components/home/participation-banner'
import { PreviewCards } from '@/components/home/preview-cards'
import { HomeLeaderboard } from '@/components/home/home-leaderboard'
import { UpcomingMatches } from '@/components/home/upcoming-matches'
import { ClosingCta } from '@/components/home/closing-cta'
import { createClient } from '@/lib/supabase/server'
import {
  getTournamentLockAt,
  isTournamentLockedAsync,
} from '@/lib/matches/lock-server'
import { aggregateLeaderboard } from '@/lib/leaderboard/aggregate'
import { GROUP_MATCHES } from '@/lib/data/matches'

export default async function HomePage() {
  const supabase = await createClient()

  const [lockAt, locked, { data: { user } }] = await Promise.all([
    getTournamentLockAt(),
    isTournamentLockedAsync(),
    supabase.auth.getUser(),
  ])

  const [
    { data: scores },
    { data: profiles },
    { data: pools },
    { data: submissions },
    { data: members },
  ] = await Promise.all([
    supabase.from('user_scores').select('user_id, pool_id, total_score'),
    supabase.from('profiles').select('id, display_name, country'),
    supabase.from('pools').select('id, slug, name').eq('is_active', true),
    supabase.from('submissions').select('user_id, pool_id'),
    supabase.from('pool_members').select('user_id, pool_id'),
  ])

  const { countryStandings, globalPlayers } = aggregateLeaderboard(
    scores ?? [],
    profiles ?? [],
    pools ?? [],
    submissions ?? [],
    members ?? [],
  )

  const officeCounts = countryStandings.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: c.memberCount,
  }))

  const totalSubmitted = officeCounts.reduce((sum, o) => sum + o.count, 0)

  const upcomingMatches = GROUP_MATCHES.slice(0, 4)

  return (
    <div className="gradient-bg min-h-screen">
      <div className="mx-auto max-w-3xl space-y-12 px-4 pb-20 pt-20 md:pt-28">
        <HeroSection lockAt={lockAt.toISOString()} locked={locked} />
        <ParticipationBanner
          totalSubmitted={totalSubmitted}
          officeCounts={officeCounts}
        />
        <PreviewCards />
        <HomeLeaderboard
          players={globalPlayers}
          countries={countryStandings}
          currentUserId={user?.id}
          locked={locked}
        />
        <UpcomingMatches matches={upcomingMatches} locked={locked} />
        <ClosingCta locked={locked} />
      </div>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>World Cup 2026 Predictor — Built for the beautiful game</p>
      </footer>
    </div>
  )
}
