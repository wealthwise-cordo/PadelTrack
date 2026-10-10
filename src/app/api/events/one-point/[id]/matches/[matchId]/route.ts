import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { submitOnePointWinner } from '@/lib/one-point-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const actor = { userId: session.userId, playerId: session.player.id }
  const body = await req.json()
  const { winnerId } = body

  if (typeof winnerId !== 'string' || !winnerId) {
    return NextResponse.json({ error: 'Invalid winner' }, { status: 400 })
  }

  const result = await submitOnePointWinner(actor, params.id, params.matchId, winnerId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
