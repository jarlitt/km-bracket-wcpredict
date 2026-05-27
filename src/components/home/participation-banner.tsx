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
    <div className="w-full rounded-xl border border-indigo-500/20 bg-indigo-950/30 px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="text-sm font-medium text-indigo-200">
          <span className="text-lg font-bold text-white tabular-nums">
            {totalSubmitted}
          </span>{' '}
          players submitted
        </span>

        <span className="hidden h-4 w-px bg-indigo-500/30 sm:block" />

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
      </div>
    </div>
  )
}
