import { NextResponse } from 'next/server'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { createOnePointEvent } from '@/lib/one-point-store'

export async function POST() {
  const season = await getActiveSeason()
  if (!season) return NextResponse.json({ error: 'No active season' }, { status: 400 })

  const players = await getPlayers(season.id)
  if (players.length !== 8) {
    return NextResponse.json({ error: 'One Point requires exactly 8 registered players' }, { status: 400 })
  }

  const id = await createOnePointEvent(players.map(p => p.id), season.id)
  return NextResponse.json({ id })
}
