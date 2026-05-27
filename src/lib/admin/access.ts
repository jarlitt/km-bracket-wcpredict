import { createClient } from '@/lib/supabase/server'

type AdminAccess =
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_authenticated' | 'not_admin' }

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: 'not_authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return { ok: false, reason: 'not_admin' }
  }

  return { ok: true, userId: user.id }
}

export async function requireAdminUser(): Promise<string> {
  const access = await getAdminAccess()

  if (!access.ok) {
    throw new Error(access.reason === 'not_authenticated' ? 'Not authenticated' : 'Not an admin')
  }

  return access.userId
}
