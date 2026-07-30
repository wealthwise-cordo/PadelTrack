import { NextRequest, NextResponse } from 'next/server'
import { createAmericanoEvent } from '@/lib/americano-store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { playerIds, scoreMode, target, isRanked } = body

  if (!Array.isArray(playerIds) || ![4, 5, 7, 8].includes(playerIds.length)) {
    return NextResponse.json({ error: 'Americano requires 4, 5, 7, or 8 players' }, { status: 400 })
  }
  if (scoreMode !== 'points' && scoreMode !== 'games') {
    return NextResponse.json({ error: 'Invalid score mode' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  const id = await createAmericanoEvent(playerIds, scoreMode, target, typeof isRanked === 'boolean' ? isRanked : true)
  return NextResponse.json({ id })
}
