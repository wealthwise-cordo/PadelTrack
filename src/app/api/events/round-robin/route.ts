import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createRoundRobinEvent } from '@/lib/round-robin-store'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { teams, target } = await req.json()

  if (!Array.isArray(teams) || ![3, 4].includes(teams.length)) {
    return NextResponse.json({ error: 'Round Robin requires 3 or 4 teams' }, { status: 400 })
  }
  for (const team of teams) {
    if (!Array.isArray(team) || team.length !== 2) {
      return NextResponse.json({ error: 'Each team must have exactly 2 players' }, { status: 400 })
    }
  }
  const roster = await validateRoster(teams.flat(), [6, 8], 'Round Robin')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })
  if (![4, 6, 8].includes(target)) {
    return NextResponse.json({ error: 'Games target must be 4, 6, or 8' }, { status: 400 })
  }

  const id = await createRoundRobinEvent(teams as [string, string][], target, session.userId)
  return NextResponse.json({ id })
}
