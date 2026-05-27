import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-next'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))
  const isPasswordRecovery = next === '/auth/reset-password'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (isPasswordRecovery) {
    return NextResponse.redirect(`${origin}/auth/reset-password?error=link_expired`)
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
