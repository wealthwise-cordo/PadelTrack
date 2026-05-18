import { NextRequest, NextResponse } from 'next/server'
import { getMatches, createMatch } from '@/lib/store'

export async function GET() {
  return NextResponse.json(getMatches())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner } = body

    const result = createMatch({ teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}
