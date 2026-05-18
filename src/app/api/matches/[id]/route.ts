import { NextRequest, NextResponse } from 'next/server'
import { updateMatch } from '@/lib/store'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { sets, winner, status } = await req.json()
    const result = await updateMatch(params.id, sets, winner ?? null, status ?? 'incomplete')
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 })
  }
}
