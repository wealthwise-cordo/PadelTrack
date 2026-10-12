import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { submitRoundRobinScore, submitLeagueScore, confirmLeagueScore, clearLeagueScore } from '@/lib/round-robin-store'

// One-off events: { teamAScore, teamBScore } from the organiser or a player.
// Leagues: { action: 'submit', sets } | { action: 'confirm' } | { action: 'clear' }
// from a player in the match.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; matchId: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const actor = { userId: session.userId, playerId: session.player.id }
  const body = await req.json().catch(() => ({}))

  let result: { ok: true } | { error: string }
  if (body.action === 'submit') result = await submitLeagueScore(actor, params.id, params.matchId, body.sets)
  else if (body.action === 'confirm') result = await confirmLeagueScore(actor, params.id, params.matchId)
  else if (body.action === 'clear') result = await clearLeagueScore(actor, params.id, params.matchId)
  else {
    const { teamAScore, teamBScore } = body
    if (typeof teamAScore !== 'number' || typeof teamBScore !== 'number') {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
    }
    result = await submitRoundRobinScore(actor, params.id, params.matchId, teamAScore, teamBScore)
  }
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
