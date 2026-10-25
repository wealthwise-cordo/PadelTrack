import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { submitScore } from '@/lib/scheduled-matches'

// A player entering the score of a match that was set up in advance. Body:
// { sets: [{ teamAGames, teamBGames }], winner: 'A' | 'B' | null, incomplete? }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!Array.isArray(b.sets)) return NextResponse.json({ error: 'Enter the score' }, { status: 400 })
  const result = await submitScore(session.userId, params.id, { sets: b.sets, winner: b.winner ?? null, incomplete: b.incomplete === true })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
