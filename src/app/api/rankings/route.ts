import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { previewPTRChanges } from '@/lib/ptr-algorithm'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets } = body

    const [p1, p2, p3, p4] = await Promise.all([
      prisma.player.findUnique({ where: { id: teamAPlayer1Id } }),
      prisma.player.findUnique({ where: { id: teamAPlayer2Id } }),
      prisma.player.findUnique({ where: { id: teamBPlayer1Id } }),
      prisma.player.findUnique({ where: { id: teamBPlayer2Id } }),
    ])

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
