import { fetchLiveMatches, type LiveMatch } from '@/lib/espn/matches'
import { MatchesList } from '@/components/matches/matches-list'
import { syncResultsIfStale } from '@/lib/sync/sync-results'

export default async function MatchesPage() {
  await syncResultsIfStale()

  let matches: LiveMatch[] = []
  let error: string | null = null

  try {
    matches = await fetchLiveMatches()
  } catch (err) {
    matches = []
    error = err instanceof Error ? err.message : 'Failed to load matches'
  }

  const fetchedAt = new Date().toISOString()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">World Cup 2026</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live scores and fixtures, refreshed every 10 minutes.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <MatchesList matches={matches} fetchedAt={fetchedAt} />
      )}
    </div>
  )
}
