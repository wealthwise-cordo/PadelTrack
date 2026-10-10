import { NextRequest, NextResponse } from 'next/server'
import { getPickablePlayers, createGuest } from '@/lib/store'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Players the signed-in user can pick: themselves, their circle, their guests.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  return NextResponse.json(await getPickablePlayers(session.userId))
}

// Adds a guest — someone who isn't on PadelTrack yet.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { name } = await req.json().catch(() => ({}))
  if (typeof name !== 'string') return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const result = await createGuest(session.userId, name)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
