import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { dismissDuplicate, mergePlayers } from '@/lib/admin-users'

// The super user resolving a possible duplicate.
// Body: { action: 'merge', keepId, removeId } | { action: 'dismiss', aId, bId }.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = b.action === 'merge'
    ? await mergePlayers(session.userId, b.keepId, b.removeId)
    : b.action === 'dismiss'
      ? await dismissDuplicate(session.userId, b.aId, b.bId)
      : { error: 'Unknown action' }
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
