import { createHmac, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRole } from '@/lib/roles'

// The super user's admin password: a second password, separate from their
// sign-in, asked before the actions that change other people's ratings,
// matches or accounts (adjusting or approving ratings, verifying guests,
// confirming, settling or voiding matches, merging players, appointing
// levellers, suspending or deleting users). Entering it unlocks those for
// UNLOCK_MINUTES on this device. Levellers' own proposals don't need it.

const UNLOCK_MINUTES = 15
const COOKIE = 'pt-admin-unlock'

// The secret Auth.js signs sessions with, so an unlock can't be forged.
function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url')

export async function hasAdminPassword(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { adminPasswordHash: true } })
  return !!u?.adminPasswordHash
}

// Setting (or changing) it needs the account password, so someone holding
// an unlocked phone can't just set their own.
export async function setAdminPassword(userId: string, accountPassword: unknown, newPassword: unknown): Promise<{ ok: true } | { error: string }> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Not allowed' }
  if (typeof accountPassword !== 'string' || typeof newPassword !== 'string') return { error: 'Fill in both passwords' }
  if (newPassword.length < 8) return { error: 'The admin password must be at least 8 characters' }
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!u || !(await bcrypt.compare(accountPassword, u.password))) return { error: 'Your account password is incorrect' }
  if (await bcrypt.compare(newPassword, u.password)) return { error: 'Use a different password from your account password' }
  await prisma.user.update({ where: { id: userId }, data: { adminPasswordHash: await bcrypt.hash(newPassword, 10) } })
  return { ok: true }
}

// Checks the admin password and unlocks super-user actions on this device.
export async function unlockAdmin(userId: string, password: unknown): Promise<{ ok: true; expires: number } | { error: string }> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Not allowed' }
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { adminPasswordHash: true } })
  if (!u?.adminPasswordHash) return { error: 'Set an admin password first' }
  if (typeof password !== 'string' || !(await bcrypt.compare(password, u.adminPasswordHash))) return { error: 'Incorrect admin password' }
  const expires = Date.now() + UNLOCK_MINUTES * 60_000
  const value = `${userId}.${expires}`
  cookies().set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: UNLOCK_MINUTES * 60,
  })
  return { ok: true, expires }
}

export function lockAdmin() {
  cookies().delete(COOKIE)
}

// When this device's unlock runs out (ms since epoch), or null if locked.
export function adminUnlockedUntil(userId: string): number | null {
  const raw = cookies().get(COOKIE)?.value
  if (!raw) return null
  const [id, expires, mac] = raw.split('.')
  if (id !== userId || !mac || Number(expires) < Date.now()) return null
  const want = Buffer.from(sign(`${id}.${expires}`))
  const got = Buffer.from(mac)
  return want.length === got.length && timingSafeEqual(want, got) ? Number(expires) : null
}

const isUnlocked = (userId: string) => adminUnlockedUntil(userId) !== null

// For API routes: null when the super user may go ahead; otherwise the
// response the client's adminFetch turns into a password prompt (423).
// Only applies to the super user — anyone else is turned away by the
// action's own role check.
export async function requireAdminUnlock(userId: string): Promise<NextResponse | null> {
  if ((await getRole(userId)) !== 'superuser') return null
  if (isUnlocked(userId)) return null
  const hasPassword = await hasAdminPassword(userId)
  return NextResponse.json(
    { error: hasPassword ? 'Enter your admin password' : 'Set an admin password first', adminLocked: true, needsSetup: !hasPassword },
    { status: 423 },
  )
}
