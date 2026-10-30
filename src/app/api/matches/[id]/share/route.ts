import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getJoinToken } from '@/lib/scheduled-matches'

// The organiser's join link for a match with open spots: { token }.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const result = await getJoinToken(session.userId, params.id)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
