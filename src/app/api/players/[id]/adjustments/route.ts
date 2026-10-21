import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { requestAdjustment } from '@/lib/rating-adjustments'

// A leveller or the super user adjusting this player's rating. Body:
// { levels: number (−1.0 to +1.0), reason: string }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await requestAdjustment(session.userId, params.id, { levels: body.levels, reason: body.reason })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
