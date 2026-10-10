import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { submitRoundRobinScore } from '@/lib/round-robin-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const actor = { userId: session.userId, playerId: session.player.id }
  const body = await req.json()
  const { teamAScore, teamBScore } = body

  if (typeof teamAScore !== 'number' || typeof teamBScore !== 'number') {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const result = await submitRoundRobinScore(actor, params.id, params.matchId, teamAScore, teamBScore)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
