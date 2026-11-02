import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requireAdminUnlock } from '@/lib/admin-auth'
import { deleteUserAccount, setSuspended } from '@/lib/admin-users'

// The super user suspending, unsuspending or deleting a player's account.
// Body: { action: 'suspend' | 'unsuspend' | 'delete', reason }.
export async function POST(req: Request, { params }: { params: { playerId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const b = await req.json().catch(() => ({}))
  const result = b.action === 'delete'
    ? await deleteUserAccount(session.userId, params.playerId, b.reason)
    : b.action === 'suspend' || b.action === 'unsuspend'
      ? await setSuspended(session.userId, params.playerId, b.action === 'suspend', b.reason)
      : { error: 'Unknown action' }
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
