import { NextRequest, NextResponse } from 'next/server'
import { signUp } from '@/lib/store'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }
  const result = await signUp({
    name: body.name,
    email: body.email,
    password: body.password,
    level: body.level,
    gender: typeof body.gender === 'string' ? body.gender : undefined,
    dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : undefined,
    country: typeof body.country === 'string' ? body.country : undefined,
    claimToken: typeof body.claimToken === 'string' ? body.claimToken : undefined,
  })
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true })
}
