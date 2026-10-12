import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createAmericanoEvent } from '@/lib/americano-store'
import { AMERICANO_SIZES, americanoMaxCourts } from '@/lib/americano'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { playerIds, scoreMode, target, courts = 1 } = await req.json()

  if (!Array.isArray(playerIds) || !AMERICANO_SIZES.includes(playerIds.length)) {
    return NextResponse.json({ error: 'Americano needs 4 to 24 players, but not 7, 11, 15, 19 or 23' }, { status: 400 })
  }
  const roster = await validateRoster(playerIds, AMERICANO_SIZES, 'Americano')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })
  if (scoreMode !== 'points' && scoreMode !== 'games') {
    return NextResponse.json({ error: 'Invalid score mode' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  if (!Number.isInteger(courts) || courts < 1 || courts > americanoMaxCourts(playerIds.length)) {
    return NextResponse.json({ error: `${playerIds.length} players can use 1 to ${americanoMaxCourts(playerIds.length)} courts` }, { status: 400 })
  }

  const id = await createAmericanoEvent(playerIds, scoreMode, target, session.userId, courts)
  return NextResponse.json({ id })
}
