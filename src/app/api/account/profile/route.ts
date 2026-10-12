import { NextResponse } from 'next/server'
import { completeProfile } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await completeProfile(session.userId, {
    gender: typeof body.gender === 'string' ? body.gender : undefined,
    dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : undefined,
    country: typeof body.country === 'string' ? body.country : undefined,
  })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
