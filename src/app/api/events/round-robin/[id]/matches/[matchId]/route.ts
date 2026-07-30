import { NextRequest, NextResponse } from 'next/server'
import { submitRoundRobinScore } from '@/lib/round-robin-store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const body = await req.json()
  const { teamAScore, teamBScore } = body

  if (typeof teamAScore !== 'number' || typeof teamBScore !== 'number') {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const result = await submitRoundRobinScore(params.id, params.matchId, teamAScore, teamBScore)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
