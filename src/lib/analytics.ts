import { prisma } from '@/lib/prisma'

// Tracking for the admin analytics page. Every call swallows its own errors:
// analytics must never break signing in or loading a page.

export async function recordSignIn(userId: string) {
  try {
    await prisma.signIn.create({ data: { userId } })
  } catch (e) {
    console.error('recordSignIn', e)
  }
}

// Active days are per UTC day. A server instance remembers who it has already
// recorded today, so most page loads skip the database write.
const seenToday = new Map<string, string>()

export async function recordActiveDay(userId: string) {
  const day = new Date().toISOString().slice(0, 10)
  if (seenToday.get(userId) === day) return
  try {
    await prisma.activeDay.createMany({ data: [{ userId, day: new Date(`${day}T00:00:00Z`) }], skipDuplicates: true })
    seenToday.set(userId, day)
  } catch (e) {
    console.error('recordActiveDay', e)
  }
}

const ERROR_RETENTION_DAYS = 90

export async function logError(entry: { source: 'server' | 'client'; error?: unknown; message?: string; stack?: string; path?: string; userId?: string }) {
  const err = entry.error instanceof Error ? entry.error : null
  const message = (entry.message ?? err?.message ?? String(entry.error ?? 'Unknown error')).slice(0, 1000)
  const stack = (entry.stack ?? err?.stack)?.slice(0, 4000)
  try {
    await prisma.errorLog.create({ data: { source: entry.source, message, stack, path: entry.path?.slice(0, 300), userId: entry.userId } })
    // Prune now and then rather than on a schedule.
    if (Math.random() < 0.02) {
      await prisma.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ERROR_RETENTION_DAYS * 864e5) } } })
    }
  } catch (e) {
    console.error('logError', e)
  }
}

// Who can open /admin: comma-separated emails in ADMIN_EMAILS.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return admins.includes(email.toLowerCase())
}
