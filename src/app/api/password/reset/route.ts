import { NextResponse } from 'next/server'
import { resetPassword } from '@/lib/store'

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Enter a new password' }, { status: 400 })
  }
  const result = await resetPassword(token, password)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true, email: result.email })
}
