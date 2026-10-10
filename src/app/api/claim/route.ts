import { NextRequest, NextResponse } from 'next/server'
import { claimGuestForUser } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== 'string') return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
  const result = await claimGuestForUser(token, session.userId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
