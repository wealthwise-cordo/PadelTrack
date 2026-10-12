import { NextResponse } from 'next/server'
import { updatePlayer } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { name, nickname, avatarColor } = await req.json().catch(() => ({}))

  if (avatarColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.length > 30)) {
    return NextResponse.json({ error: 'Invalid nickname' }, { status: 400 })
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length > 40)) {
    return NextResponse.json({ error: 'Display name must be 40 characters or fewer' }, { status: 400 })
  }

  const result = await updatePlayer(params.id, session.userId, { name, nickname, avatarColor })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
