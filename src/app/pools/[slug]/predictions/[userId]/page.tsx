import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function UserPredictionViewerPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>
}) {
  const { slug, userId } = await params
  const supabase = await createClient()

  const { data: pool } = await supabase
    .from('pools')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()
  if (!pool) notFound()

  const [{ data: profile }, { data: groupRows }, { data: knockoutRows }] = await Promise.all([
    supabase.from('profiles').select('display_name, country').eq('id', userId).maybeSingle(),
    supabase
      .from('group_predictions')
      .select('match_id, predicted_score_a, predicted_score_b')
      .eq('user_id', userId)
      .eq('pool_id', pool.id),
    supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id')
      .eq('user_id', userId)
      .eq('pool_id', pool.id),
  ])

  if (!profile || (groupRows ?? []).length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Bracket unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This bracket is unavailable until the tournament starts.
        </p>
        <Link href={`/pools/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to {pool.name}
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Link href={`/pools/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {pool.name}
        </Link>
      </div>
      <h1 className="text-2xl font-bold">{profile.display_name}&apos;s bracket</h1>
      <p className="text-sm text-muted-foreground">
        {pool.name} · {groupRows?.length ?? 0} group predictions · {knockoutRows?.length ?? 0} knockout predictions
      </p>
      <div className="rounded-xl border border-border/50 bg-card/50 p-4">
        <p className="text-sm text-muted-foreground">
          Full bracket visualization coming soon. This player submitted {groupRows?.length ?? 0} group
          and {knockoutRows?.length ?? 0} knockout predictions.
        </p>
      </div>
    </main>
  )
}
