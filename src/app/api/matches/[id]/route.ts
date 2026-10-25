import { NextRequest, NextResponse } from 'next/server'
import { deleteMatch } from '@/lib/store'
import { getSession } from '@/lib/session'
import { updateScheduledMatch } from '@/lib/scheduled-matches'

// Removes a pending match you played in (withdraw or reject). For a match set
// up in advance, only its organiser can do this, and it cancels it.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const result = await deleteMatch(params.id, session.userId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}

// The organiser changing a scheduled match: players, start time, venue,
// ranked or friendly.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = await updateScheduledMatch(session.userId, params.id, {
    teamAPlayer1Id: b.teamAPlayer1Id, teamAPlayer2Id: b.teamAPlayer2Id, teamBPlayer1Id: b.teamBPlayer1Id, teamBPlayer2Id: b.teamBPlayer2Id,
    startsAt: b.startsAt,
    location: typeof b.location === 'string' ? b.location : undefined,
    clubId: typeof b.clubId === 'string' ? b.clubId : undefined,
    isRanked: b.isRanked !== false,
  })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
