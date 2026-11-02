import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requireAdminUnlock } from '@/lib/admin-auth'
import { setLeveller } from '@/lib/rating-adjustments'

// The super user appointing ({ email }) or removing ({ userId }) a leveller.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const body = await req.json().catch(() => ({}))
  const result = await setLeveller(session.userId, { email: body.email }, true)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const body = await req.json().catch(() => ({}))
  const result = await setLeveller(session.userId, { userId: body.userId }, false)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
