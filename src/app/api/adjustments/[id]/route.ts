import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { reviewAdjustment } from '@/lib/rating-adjustments'

// The super user approving or rejecting a leveller's adjustment. Body:
// { action: 'approve' | 'reject', note?: string }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await reviewAdjustment(session.userId, params.id, { action: body.action, note: body.note })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
