import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requireAdminUnlock } from '@/lib/admin-auth'
import { adminMatchAction, removeConfirmedMatch } from '@/lib/admin-matches'

// The super user confirming, settling or voiding an unconfirmed match, or
// removing a confirmed one. Body: { action: 'confirm' | 'settle' | 'void' |
// 'remove', reason, reportId? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const locked = await requireAdminUnlock(session.userId)
  if (locked) return locked
  const b = await req.json().catch(() => ({}))
  const result = b.action === 'remove'
    ? await removeConfirmedMatch(session.userId, params.id, { reason: b.reason })
    : await adminMatchAction(session.userId, params.id, { action: b.action, reason: b.reason, reportId: b.reportId })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
