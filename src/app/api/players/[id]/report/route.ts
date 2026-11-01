import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { reportPlayer } from '@/lib/safety'

// Report a player. Body: { reason, details? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = await reportPlayer(session.userId, params.id, b.reason, b.details)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
