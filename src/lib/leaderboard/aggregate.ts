interface ScoreRow {
  user_id: string
  pool_id: string
  total_score: number
}

interface ProfileRow {
  id: string
  display_name: string
  country: string
}

interface PoolRow {
  id: string
  slug: string
  name: string
}

interface SubmissionRow {
  user_id: string
  pool_id: string
}

export interface CountryStanding {
  slug: string
  name: string
  avgScore: number
  totalScore: number
  memberCount: number
}

export interface GlobalPlayer {
  rank: number
  userId: string
  displayName: string
  country: string
  totalScore: number
}

export function aggregateLeaderboard(
  scores: ScoreRow[],
  profiles: ProfileRow[],
  pools: PoolRow[],
  submissions: SubmissionRow[] = [],
): { countryStandings: CountryStanding[]; globalPlayers: GlobalPlayer[] } {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const poolById = new Map(pools.map((pool) => [pool.id, pool]))
  const statsByCountry = new Map<string, { totalScore: number; memberCount: number }>()

  for (const pool of pools) {
    statsByCountry.set(pool.slug, { totalScore: 0, memberCount: 0 })
  }

  const scoredUserIds = new Set(scores.map((s) => s.user_id))

  const globalPlayers: GlobalPlayer[] = []

  for (const score of scores) {
    const profile = profileById.get(score.user_id)
    if (!profile) continue
    const stats = statsByCountry.get(profile.country)
    if (stats) {
      stats.totalScore += score.total_score
      stats.memberCount += 1
    }
    globalPlayers.push({
      rank: 0,
      userId: score.user_id,
      displayName: profile.display_name,
      country: profile.country,
      totalScore: score.total_score,
    })
  }

  for (const sub of submissions) {
    if (scoredUserIds.has(sub.user_id)) continue
    const profile = profileById.get(sub.user_id)
    if (!profile) continue
    const pool = poolById.get(sub.pool_id)
    if (!pool) continue
    const stats = statsByCountry.get(pool.slug)
    if (stats) {
      stats.memberCount += 1
    }
    globalPlayers.push({
      rank: 0,
      userId: sub.user_id,
      displayName: profile.display_name,
      country: profile.country,
      totalScore: 0,
    })
  }

  globalPlayers.sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName))
  globalPlayers.forEach((player, index) => { player.rank = index + 1 })

  const countryStandings = pools
    .map((pool, index) => {
      const stats = statsByCountry.get(pool.slug) ?? { totalScore: 0, memberCount: 0 }
      return {
        _index: index,
        slug: pool.slug,
        name: pool.name,
        totalScore: stats.totalScore,
        memberCount: stats.memberCount,
        avgScore: stats.memberCount === 0 ? 0 : stats.totalScore / stats.memberCount,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore || a._index - b._index)
    .map(({ _index, ...standing }) => standing)

  return { countryStandings, globalPlayers }
}
