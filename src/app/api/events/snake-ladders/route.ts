import { NextRequest, NextResponse } from 'next/server'
import { getPlayers } from '@/lib/store'
import { createSnakeLaddersEvent } from '@/lib/snake-ladders-store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { scoreMode, target, totalRounds, isRanked } = body

  const players = await getPlayers()
  if (players.length !== 8) {
    return NextResponse.json({ error: 'Snake and Ladders requires exactly 8 registered players' }, { status: 400 })
  }
  if (scoreMode !== 'points' && scoreMode !== 'games') {
    return NextResponse.json({ error: 'Invalid score mode' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || totalRounds < 2) {
    return NextResponse.json({ error: 'Invalid number of rounds' }, { status: 400 })
  }

  const id = await createSnakeLaddersEvent(
    players.map(p => p.id),
    scoreMode,
    target,
    totalRounds,
    typeof isRanked === 'boolean' ? isRanked : true
  )
  return NextResponse.json({ id })
}
