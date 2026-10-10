import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createAmericanoEvent } from '@/lib/americano-store'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { playerIds, scoreMode, target } = await req.json()

  const roster = await validateRoster(playerIds, [4, 5, 7, 8], 'Americano')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })
  if (scoreMode !== 'points' && scoreMode !== 'games') {
    return NextResponse.json({ error: 'Invalid score mode' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  const id = await createAmericanoEvent(playerIds, scoreMode, target, session.userId)
  return NextResponse.json({ id })
}
