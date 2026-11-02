import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requireAdminUnlock } from '@/lib/admin-auth'
import { verifyGuest } from '@/lib/admin-users'

// The super user verifying a guest as a ranked guest. Body: { level }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const b = await req.json().catch(() => ({}))
  const result = await verifyGuest(session.userId, params.id, b.level)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
