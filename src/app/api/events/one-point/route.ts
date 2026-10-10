import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createOnePointEvent } from '@/lib/one-point-store'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { playerIds } = await req.json()

  const roster = await validateRoster(playerIds, [8], 'One Point')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })

  // Seeded by rating, highest first.
  const id = await createOnePointEvent(roster.players.map(p => p.id), session.userId)
  return NextResponse.json({ id })
}
