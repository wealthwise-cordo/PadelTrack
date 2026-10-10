import { NextResponse } from 'next/server'
import { updatePlayer } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { nickname, avatarColor } = await req.json().catch(() => ({}))

  if (avatarColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.length > 30)) {
    return NextResponse.json({ error: 'Invalid nickname' }, { status: 400 })
  }

  const result = await updatePlayer(params.id, session.userId, { nickname, avatarColor })
  if ('error' in result) return NextResponse.json(result, { status: 403 })
  return NextResponse.json({ ok: true })
}
