import { NextResponse } from 'next/server'
import { changePassword } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'Enter your current and new password' }, { status: 400 })
  }
  const result = await changePassword(session.userId, currentPassword, newPassword)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
