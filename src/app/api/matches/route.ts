import { NextRequest, NextResponse } from 'next/server'
import { getMatchesForPlayer, createMatch } from '@/lib/store'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  return NextResponse.json(await getMatchesForPlayer(session.player.id))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  try {
    const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner, playedOn, location, clubId, isRanked } = await req.json()
    const result = await createMatch(session.userId, {
      teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner,
      playedOn: typeof playedOn === 'string' ? playedOn : undefined,
      location: typeof location === 'string' ? location : undefined,
      clubId: typeof clubId === 'string' ? clubId : undefined,
      isRanked: isRanked !== false,
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to record match' }, { status: 500 })
  }
}
