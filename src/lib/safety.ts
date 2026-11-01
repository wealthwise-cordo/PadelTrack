import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { adminEmails } from '@/lib/analytics'
import { REPORT_REASONS, type ReportReason } from '@/lib/safety-reasons'

// Blocking and reporting players (what Apple asks of apps where players see
// each other). A block works both ways for the pair: neither sees the other
// in search, pickers or their ranking, and neither can put the other in a
// match. Reports go to the super user, who resolves them in Admin → Reports.


type Result = { ok: true } | { error: string }

// Players hidden from this user: ones they blocked, and ones whose user
// blocked them.
export async function hiddenPlayerIds(userId: string, playerId: string | null | undefined): Promise<Set<string>> {
  const [mine, theirs] = await Promise.all([
    prisma.playerBlock.findMany({ where: { userId }, select: { playerId: true } }),
    playerId
      ? prisma.playerBlock.findMany({ where: { playerId }, select: { user: { select: { player: { select: { id: true } } } } } })
      : Promise.resolve([]),
  ])
  const ids = new Set(mine.map(b => b.playerId))
  for (const b of theirs) if (b.user.player) ids.add(b.user.player.id)
  return ids
}

// Whether any of these players is blocked from playing with this user.
export async function blocksAny(userId: string, playerId: string, otherPlayerIds: string[]): Promise<boolean> {
  const others = otherPlayerIds.filter(id => id && id !== playerId)
  if (!others.length) return false
  const hidden = await hiddenPlayerIds(userId, playerId)
  return others.some(id => hidden.has(id))
}

export async function isBlocking(userId: string, playerId: string): Promise<boolean> {
  return !!(await prisma.playerBlock.findUnique({ where: { userId_playerId: { userId, playerId } } }))
}

export async function blockPlayer(userId: string, playerId: string): Promise<Result> {
  const target = await prisma.player.findUnique({ where: { id: playerId }, select: { userId: true, deletedAt: true } })
  if (!target || target.deletedAt) return { error: 'Player not found' }
  if (target.userId === userId) return { error: 'You can’t block yourself' }
  await prisma.playerBlock.upsert({ where: { userId_playerId: { userId, playerId } }, create: { userId, playerId }, update: {} })
  return { ok: true }
}

export async function unblockPlayer(userId: string, playerId: string): Promise<Result> {
  await prisma.playerBlock.deleteMany({ where: { userId, playerId } })
  return { ok: true }
}

export async function reportPlayer(userId: string, playerId: string, reason: unknown, details: unknown): Promise<Result> {
  if (typeof reason !== 'string' || !(reason in REPORT_REASONS)) return { error: 'Pick a reason' }
  const target = await prisma.player.findUnique({ where: { id: playerId }, select: { name: true, userId: true } })
  if (!target) return { error: 'Player not found' }
  if (target.userId === userId) return { error: 'You can’t report yourself' }
  const text = typeof details === 'string' ? details.trim().slice(0, 1000) : ''
  await prisma.playerReport.create({ data: { reporterId: userId, playerId, reason, details: text || null } })
  // Tell the super user(s) straight away.
  const admins = await prisma.user.findMany({
    where: { OR: [{ role: 'superuser' }, { email: { in: adminEmails() } }] },
    select: { id: true },
  })
  await sendPush(admins.map(a => a.id), {
    title: 'New player report',
    body: `${target.name}: ${REPORT_REASONS[reason as ReportReason]}`,
    url: '/admin/reports',
    tag: `report-${playerId}`,
  })
  return { ok: true }
}

// --- Admin → Reports -----------------------------------------------------------

export function countOpenReports(): Promise<number> {
  return prisma.playerReport.count({ where: { status: 'open' } })
}

// Open reports oldest first, then the last 30 resolved.
export async function getReports() {
  const include = {
    player: { select: { id: true, name: true, userId: true, deletedAt: true } },
    reporter: { select: { name: true, player: { select: { id: true } } } },
    resolvedBy: { select: { name: true } },
  } as const
  const [open, resolved] = await Promise.all([
    prisma.playerReport.findMany({ where: { status: 'open' }, include, orderBy: { createdAt: 'asc' } }),
    prisma.playerReport.findMany({ where: { status: 'resolved' }, include, orderBy: { resolvedAt: 'desc' }, take: 30 }),
  ])
  return { open, resolved }
}

export async function resolveReport(userId: string, reportId: string, resolution: unknown): Promise<Result> {
  const note = typeof resolution === 'string' ? resolution.trim().slice(0, 500) : ''
  const done = await prisma.playerReport.updateMany({
    where: { id: reportId, status: 'open' },
    data: { status: 'resolved', resolution: note || null, resolvedAt: new Date(), resolvedById: userId },
  })
  return done.count ? { ok: true } : { error: 'This report has already been resolved' }
}
