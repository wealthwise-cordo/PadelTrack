import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createSnakeLaddersEvent } from '@/lib/snake-ladders-store'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { playerIds, scoreMode, target, totalRounds } = await req.json()

  const roster = await validateRoster(playerIds, [8], 'Snake and Ladders')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })
  if (scoreMode !== 'points' && scoreMode !== 'games') {
    return NextResponse.json({ error: 'Invalid score mode' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || totalRounds < 2) {
    return NextResponse.json({ error: 'Invalid number of rounds' }, { status: 400 })
  }

  // Seeded by rating, highest first.
  const id = await createSnakeLaddersEvent(roster.players.map(p => p.id), scoreMode, target, totalRounds, session.userId)
  return NextResponse.json({ id })
}
