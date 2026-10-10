import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { deleteOnePointEvent } from '@/lib/one-point-store'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const actor = { userId: session.userId, playerId: session.player.id }
  const result = await deleteOnePointEvent(params.id, actor)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
