import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export function isMissingProfileForMembershipError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  return (
    error?.code === '23503' &&
    typeof error.message === 'string' &&
    error.message.includes('pool_members_user_id_fkey')
  )
}

export async function ensureProfileForUser(
  supabase: SupabaseServerClient,
  user: User,
): Promise<string | null> {
  const displayName =
    typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : user.email?.split('@')[0] ?? 'User'

  const avatarUrl =
    typeof user.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : null

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      },
      { onConflict: 'id' },
    )

  return error?.message ?? null
}
