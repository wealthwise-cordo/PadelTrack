import { NextRequest, NextResponse } from 'next/server'
import { createRoundRobinEvent } from '@/lib/round-robin-store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { teams, target, isRanked } = body

  if (!Array.isArray(teams) || ![3, 4].includes(teams.length)) {
    return NextResponse.json({ error: 'Round Robin requires 3 or 4 teams' }, { status: 400 })
  }
  for (const team of teams) {
    if (!Array.isArray(team) || team.length !== 2 || team.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Each team must have exactly 2 players' }, { status: 400 })
    }
  }
  const allIds = teams.flat()
  if (new Set(allIds).size !== allIds.length) {
    return NextResponse.json({ error: 'A player cannot appear on more than one team' }, { status: 400 })
  }
  if (![4, 6, 8].includes(target)) {
    return NextResponse.json({ error: 'Games target must be 4, 6, or 8' }, { status: 400 })
  }

  const id = await createRoundRobinEvent(teams as [string, string][], target, typeof isRanked === 'boolean' ? isRanked : true)
  return NextResponse.json({ id })
}
