import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// The iPhone app's device token (Apple push) for the signed-in user. Body:
// { token }. Saving it again moves it to whoever is signed in now.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || !/^[0-9a-f]{32,200}$/i.test(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  await prisma.nativePushToken.upsert({
    where: { token },
    create: { token, userId: session.userId },
    update: { userId: session.userId },
  })
  return NextResponse.json({ ok: true })
}

// Turns notifications off for this phone.
export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { token } = await req.json().catch(() => ({}))
  if (typeof token === 'string') await prisma.nativePushToken.deleteMany({ where: { token, userId: session.userId } })
  return NextResponse.json({ ok: true })
}
