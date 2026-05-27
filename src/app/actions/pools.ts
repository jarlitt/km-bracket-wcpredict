'use server'

import { createClient } from '@/lib/supabase/server'
import type { Pool, PoolType, PoolVisibility } from '@/types'

interface PoolRow {
  id: string
  name: string
  slug: string
  type: PoolType
  visibility: PoolVisibility
  is_active: boolean
  created_at: string
}

function poolRowToPool(row: PoolRow): Pool {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    visibility: row.visibility,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export async function listAvailablePools(): Promise<Pool[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pools')
    .select('id, name, slug, type, visibility, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data.map(poolRowToPool)
}

export async function getPoolBySlug(slug: string): Promise<Pool | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pools')
    .select('id, name, slug, type, visibility, is_active, created_at')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  return poolRowToPool(data as PoolRow)
}
