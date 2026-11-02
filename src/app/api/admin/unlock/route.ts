import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { lockAdmin, unlockAdmin } from '@/lib/admin-auth'

// Entering the admin password (POST { password }) unlocks super-user actions
// on this device for a while; DELETE locks them again.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { password } = await req.json().catch(() => ({}))
  const result = await unlockAdmin(session.userId, password)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}

export async function DELETE() {
  lockAdmin()
  return NextResponse.json({ ok: true })
}
