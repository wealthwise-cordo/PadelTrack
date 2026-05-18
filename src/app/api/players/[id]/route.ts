import { NextResponse } from 'next/server'
import { updatePlayer } from '@/lib/store'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { nickname, avatarColor } = body

  if (avatarColor && !/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }

  const result = await updatePlayer(params.id, { nickname, avatarColor })
  if ('error' in result) return NextResponse.json(result, { status: 404 })
  return NextResponse.json({ ok: true })
}
