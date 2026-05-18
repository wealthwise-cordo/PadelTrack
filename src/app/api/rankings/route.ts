import { NextRequest, NextResponse } from 'next/server'
import { getPlayerRaw } from '@/lib/store'
import { previewPTRChanges } from '@/lib/ptr-algorithm'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets } = body

    const p1 = getPlayerRaw(teamAPlayer1Id)
    const p2 = getPlayerRaw(teamAPlayer2Id)
    const p3 = getPlayerRaw(teamBPlayer1Id)
    const p4 = getPlayerRaw(teamBPlayer2Id)

    if (!p1 || !p2 || !p3 || !p4) {
      return NextResponse.json({ error: 'Players not found' }, { status: 404 })
    }

    const preview = previewPTRChanges(
      [p1.ptr, p2.ptr],
      [p3.ptr, p4.ptr],
      [p1.matchesPlayed, p2.matchesPlayed],
      [p3.matchesPlayed, p4.matchesPlayed],
      sets || []
    )

    return NextResponse.json(preview)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to calculate preview' }, { status: 500 })
  }
}
