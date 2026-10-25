import { NextRequest, NextResponse } from 'next/server'
import { confirmMatch } from '@/lib/store'
import { getSession } from '@/lib/session'
import { confirmReport } from '@/lib/scheduled-matches'

// Confirms the score. For a disputed scheduled match, { reportId } picks
// which of the entered scores is right.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { reportId } = await req.json().catch(() => ({}))
  const result = typeof reportId === 'string'
    ? await confirmReport(session.userId, params.id, reportId)
    : await confirmMatch(params.id, session.userId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
