import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Saves this device's push subscription for the signed-in user.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const sub = await req.json().catch(() => null)
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, userId: session.userId },
    update: { p256dh, auth, userId: session.userId },
  })
  return NextResponse.json({ ok: true })
}

// Turns notifications off for this device.
export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { endpoint } = await req.json().catch(() => ({}))
  if (typeof endpoint === 'string') await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } })
  return NextResponse.json({ ok: true })
}
