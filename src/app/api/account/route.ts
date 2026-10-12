import { NextResponse } from 'next/server'
import { deleteAccount } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { password } = await req.json().catch(() => ({}))
  if (typeof password !== 'string' || !password) return NextResponse.json({ error: 'Enter your password' }, { status: 400 })
  const result = await deleteAccount(session.userId, password)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
