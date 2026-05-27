import type { PoolType, PoolVisibility } from '@/types'

export interface SeedPool {
  name: string
  slug: string
  type: PoolType
  visibility: PoolVisibility
}

export const PHASE_1_POOLS: SeedPool[] = [
  { name: 'Spain Office', slug: 'spain', type: 'office', visibility: 'public' },
  { name: 'Malta Office', slug: 'malta', type: 'office', visibility: 'public' },
  { name: 'Nigeria Office', slug: 'nigeria', type: 'office', visibility: 'public' },
  { name: 'South Africa Office', slug: 'south-africa', type: 'office', visibility: 'public' },
  { name: 'Zambia Office', slug: 'zambia', type: 'office', visibility: 'public' },
  { name: 'UK Office', slug: 'uk', type: 'office', visibility: 'public' },
]

export const PHASE_1_POOL_SLUGS = PHASE_1_POOLS.map((p) => p.slug)

export function isOfficePoolSlug(slug: string): boolean {
  return PHASE_1_POOL_SLUGS.includes(slug)
}
