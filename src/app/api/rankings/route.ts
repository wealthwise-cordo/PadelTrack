import { NextRequest, NextResponse } from 'next/server'
import { getPlayerRaw } from '@/lib/store'
import { getSession } from '@/lib/session'
import { previewPTRChanges, currentReliability } from '@/lib/ptr-algorithm'

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  try {
    const body = await req.json()
    const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets } = body

    const [p1, p2, p3, p4] = await Promise.all([
      getPlayerRaw(teamAPlayer1Id),
      getPlayerRaw(teamAPlayer2Id),
      getPlayerRaw(teamBPlayer1Id),
      getPlayerRaw(teamBPlayer2Id),
    ])

    if (!p1 || !p2 || !p3 || !p4) {
      return NextResponse.json({ error: 'Players not found' }, { status: 404 })
    }

    const preview = previewPTRChanges(
      [p1.ptr, p2.ptr],
      [p3.ptr, p4.ptr],
      [currentReliability(p1.reliability, p1.lastRankedPlayedAt), currentReliability(p2.reliability, p2.lastRankedPlayedAt)],
      [currentReliability(p3.reliability, p3.lastRankedPlayedAt), currentReliability(p4.reliability, p4.lastRankedPlayedAt)],
      sets || []
    )

    return NextResponse.json(preview)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to calculate preview' }, { status: 500 })
  }
}
