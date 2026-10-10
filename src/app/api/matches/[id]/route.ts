import { NextRequest, NextResponse } from 'next/server'
import { deleteMatch } from '@/lib/store'
import { getSession } from '@/lib/session'

// Deletes a match you played in. For a pending match this is a reject; for a
// confirmed one it reverses the rating changes.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const result = await deleteMatch(params.id, session.userId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
