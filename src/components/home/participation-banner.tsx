import { PoolFlag } from '@/components/pools/pool-flag'

interface OfficeCount {
  slug: string
  name: string
  count: number
}

export function ParticipationBanner({
  totalSubmitted,
  officeCounts,
}: {
  totalSubmitted: number
  officeCounts: OfficeCount[]
}) {
  if (totalSubmitted === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        {totalSubmitted} Players Submitted
      </h2>

      <div className="flex flex-wrap gap-2">
        {officeCounts.map((office) => (
          <span
            key={office.slug}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-100"
          >
            <PoolFlag slug={office.slug} size={16} />
            <span>{office.name.replace(/ Office$/, '')}</span>
            <span className="font-bold tabular-nums">{office.count}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
