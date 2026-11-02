import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requireAdminUnlock } from '@/lib/admin-auth'
import { deleteGuest } from '@/lib/admin-users'

// The super user deleting a guest. Body: { reason }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const b = await req.json().catch(() => ({}))
  const result = await deleteGuest(session.userId, params.id, b.reason)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
