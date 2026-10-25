import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { adminMatchAction } from '@/lib/admin-matches'

// The super user confirming, settling or voiding an unconfirmed match.
// Body: { action: 'confirm' | 'settle' | 'void', reason, reportId? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = await adminMatchAction(session.userId, params.id, { action: b.action, reason: b.reason, reportId: b.reportId })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
