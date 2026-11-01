import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { blockPlayer, unblockPlayer } from '@/lib/safety'

// Block (POST) or unblock (DELETE) a player.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const result = await blockPlayer(session.userId, params.id)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  return NextResponse.json(await unblockPlayer(session.userId, params.id))
}
