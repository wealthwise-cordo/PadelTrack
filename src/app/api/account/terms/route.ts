import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { acceptTerms } from '@/lib/store'

// The signed-in user agreeing to the current Terms of Use and Privacy notice.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  await acceptTerms(session.userId)
  return NextResponse.json({ ok: true })
}
