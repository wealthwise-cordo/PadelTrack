import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { joinMatch } from '@/lib/scheduled-matches'

// Taking an open spot through a join link. Body: { seat: 0–3 }.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = await joinMatch(session.userId, params.token, Number(b.seat))
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
