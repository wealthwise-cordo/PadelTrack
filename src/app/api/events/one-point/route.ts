import { NextResponse } from 'next/server'
import { getPlayers } from '@/lib/store'
import { createOnePointEvent } from '@/lib/one-point-store'

export async function POST() {
  const players = await getPlayers()
  if (players.length !== 8) {
    return NextResponse.json({ error: 'One Point requires exactly 8 registered players' }, { status: 400 })
  }

  const id = await createOnePointEvent(players.map(p => p.id))
  return NextResponse.json({ id })
}
