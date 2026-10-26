import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { INTERNAL_PER_LEVEL, MAX_LEVEL, MIN_LEVEL, internalFromLevel } from '@/lib/lta'
import { canAdjustRatings, effectiveRole, getRole } from '@/lib/roles'

// Manual rating adjustments. The controls:
//   - only levellers and the super user can make them, never to their own
//     rating, and levellers can't adjust a super user's;
//   - at most one LTA level up or down at a time (any amount up to that, in
//     hundredths), and never outside 1.0–7.0;
//   - a reason is required;
//   - a leveller's adjustment waits for the super user to approve it; the
//     super user's applies straight away;
//   - a player can have only one adjustment waiting at a time, and after an
//     adjustment is applied or rejected there's a 30-day cooling-off period
//     before the next can be requested (for everyone, the super user
//     included).
// Players see that their rating was adjusted, never the reason.
// Applied adjustments are a PTRHistory row, so they show in the player's
// rating history. Reliability and match stats are left alone.

export const MAX_ADJUST_LEVELS = 1
export const MIN_REASON_LENGTH = 10
export const MAX_REASON_LENGTH = 500
export const COOLING_OFF_DAYS = 30
const DAY_MS = 864e5

const MIN_INTERNAL = internalFromLevel(MIN_LEVEL)
const MAX_INTERNAL = internalFromLevel(MAX_LEVEL)

type Result<T = object> = ({ ok: true } & T) | { error: string }
type Db = Pick<typeof prisma, 'ratingAdjustment'>

// When this player can next be adjusted: 30 days after their latest applied
// or rejected adjustment, or null if that's now.
async function coolingOffUntil(db: Db, playerId: string, now = new Date()): Promise<Date | null> {
  const last = await db.ratingAdjustment.findFirst({
    where: { playerId, status: { in: ['approved', 'rejected'] } },
    orderBy: { reviewedAt: 'desc' },
    select: { reviewedAt: true, createdAt: true },
  })
  if (!last) return null
  const until = new Date((last.reviewedAt ?? last.createdAt).getTime() + COOLING_OFF_DAYS * DAY_MS)
  return until > now ? until : null
}

const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })

export async function requestAdjustment(
  userId: string,
  playerId: string,
  input: { levels: unknown; reason: unknown },
): Promise<Result<{ status: 'pending' | 'approved' }>> {
  const role = await getRole(userId)
  if (!canAdjustRatings(role)) return { error: 'Only levellers can adjust ratings' }

  const levels = typeof input.levels === 'number' ? Math.round(input.levels * 100) / 100 : NaN
  if (!Number.isFinite(levels) || levels === 0) return { error: 'Choose how much to adjust the rating by' }
  if (Math.abs(levels) > MAX_ADJUST_LEVELS) return { error: `An adjustment can be at most ${MAX_ADJUST_LEVELS.toFixed(1)} level up or down` }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < MIN_REASON_LENGTH) return { error: `Give a reason of at least ${MIN_REASON_LENGTH} characters` }
  if (reason.length > MAX_REASON_LENGTH) return { error: `Keep the reason to ${MAX_REASON_LENGTH} characters` }

  const delta = levels * INTERNAL_PER_LEVEL
  const isSuper = role === 'superuser'

  const result = await prisma.$transaction(async tx => {
    const player = await tx.player.findUnique({ where: { id: playerId } })
    if (!player || player.deletedAt) return { error: 'Player not found' } as const
    if (!player.userId) return { error: 'Guests have no rating to adjust until they join' } as const
    if (player.userId === userId) return { error: 'You can’t adjust your own rating' } as const
    // Nobody could approve it: the super user can't review their own rating.
    if (!isSuper) {
      const owner = await tx.user.findUnique({ where: { id: player.userId }, select: { role: true, email: true } })
      if (effectiveRole(owner) === 'superuser') return { error: 'Levellers can’t adjust a super user’s rating' } as const
    }
    const after = player.ptr + delta
    if (after < MIN_INTERNAL - 1e-6 || after > MAX_INTERNAL + 1e-6) return { error: `Ratings must stay between ${MIN_LEVEL.toFixed(1)} and ${MAX_LEVEL.toFixed(1)}` } as const
    const waiting = await tx.ratingAdjustment.count({ where: { playerId, status: 'pending' } })
    if (waiting > 0) return { error: 'This player already has an adjustment waiting for review' } as const
    const until = await coolingOffUntil(tx, playerId)
    if (until) return { error: `This player had an adjustment approved or rejected in the last ${COOLING_OFF_DAYS} days — the next one can be made from ${dayLabel(until)}` } as const

    const adj = await tx.ratingAdjustment.create({
      data: {
        playerId, requestedById: userId, delta, reason, ptrAtRequest: player.ptr,
        status: isSuper ? 'approved' : 'pending',
        ...(isSuper && { reviewedById: userId, reviewedAt: new Date() }),
      },
    })
    if (isSuper) await applyInTx(tx, adj.id, playerId, delta)
    return { ok: true, status: adj.status as 'pending' | 'approved', playerName: player.name } as const
  })
  if ('error' in result) return result

  if (!isSuper) {
    const supers = await superUserIds()
    await sendPush(supers, {
      title: 'Rating adjustment to review',
      body: `${result.playerName}: ${levels > 0 ? '+' : '−'}${Math.abs(levels).toFixed(2)} — ${reason.slice(0, 80)}`,
      url: '/admin/ratings',
      tag: 'rating-adjustment',
    })
  }
  return { ok: true, status: result.status }
}

export async function reviewAdjustment(
  userId: string,
  adjustmentId: string,
  input: { action: unknown; note: unknown },
): Promise<Result> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Only the super user can review adjustments' }
  const action = input.action
  if (action !== 'approve' && action !== 'reject') return { error: 'Approve or reject' }
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, MAX_REASON_LENGTH) : ''

  return prisma.$transaction(async tx => {
    const adj = await tx.ratingAdjustment.findUnique({ where: { id: adjustmentId }, include: { player: true } })
    if (!adj) return { error: 'Adjustment not found' }
    if (adj.status !== 'pending') return { error: 'This adjustment has already been reviewed' }
    if (adj.player.userId === userId) return { error: 'You can’t approve a change to your own rating' }
    if (action === 'approve') {
      const until = await coolingOffUntil(tx, adj.playerId)
      if (until) return { error: `This player had an adjustment approved or rejected in the last ${COOLING_OFF_DAYS} days — reject this, or wait until ${dayLabel(until)}` }
    }

    let delta = adj.delta
    if (action === 'approve') {
      // Applied as a change from the rating now (it may have moved since the
      // request), kept inside 1.0–7.0.
      const after = Math.min(MAX_INTERNAL, Math.max(MIN_INTERNAL, adj.player.ptr + adj.delta))
      delta = after - adj.player.ptr
      if (Math.abs(delta) < 1e-6) return { error: 'The rating is already at the limit, so this would change nothing — reject it instead' }
    }
    // Guards against two reviews at once.
    const claimed = await tx.ratingAdjustment.updateMany({
      where: { id: adjustmentId, status: 'pending' },
      data: { status: action === 'approve' ? 'approved' : 'rejected', reviewedById: userId, reviewedAt: new Date(), reviewNote: note || null, delta },
    })
    if (claimed.count === 0) return { error: 'This adjustment has already been reviewed' }
    if (action === 'approve') await applyInTx(tx, adj.id, adj.playerId, delta)
    return { ok: true }
  })
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function applyInTx(tx: Tx, adjustmentId: string, playerId: string, delta: number) {
  const p = await tx.player.findUniqueOrThrow({ where: { id: playerId } })
  await tx.player.update({ where: { id: playerId }, data: { ptr: p.ptr + delta } })
  await tx.pTRHistory.create({
    data: { playerId, adjustmentId, ptrBefore: p.ptr, ptrAfter: p.ptr + delta, delta, reliability: p.reliability },
  })
}

async function superUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { OR: [{ role: 'superuser' }, { email: { in: adminEmails(), mode: 'insensitive' } }] }, select: { id: true } })
  return rows.map(r => r.id)
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
}

// --- Reads ------------------------------------------------------------------

const adjustmentInclude = {
  player: { select: { id: true, name: true, avatarColor: true, ptr: true } },
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} as const

export async function getPendingAdjustments() {
  return prisma.ratingAdjustment.findMany({ where: { status: 'pending' }, include: adjustmentInclude, orderBy: { createdAt: 'asc' } })
}

export async function countPendingAdjustments() {
  return prisma.ratingAdjustment.count({ where: { status: 'pending' } })
}

// Reviewed adjustments, newest first; a leveller sees only their own.
export async function getAdjustmentLog(opts: { requestedById?: string; take?: number } = {}) {
  return prisma.ratingAdjustment.findMany({
    where: opts.requestedById ? { requestedById: opts.requestedById } : { status: { not: 'pending' } },
    include: adjustmentInclude,
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
  })
}

// Players in their cooling-off period, soonest to come out first.
export async function getCoolingOffPlayers(now = new Date()) {
  const since = new Date(now.getTime() - COOLING_OFF_DAYS * DAY_MS)
  const rows = await prisma.ratingAdjustment.findMany({
    where: { status: { in: ['approved', 'rejected'] }, OR: [{ reviewedAt: { gt: since } }, { reviewedAt: null, createdAt: { gt: since } }] },
    select: { reviewedAt: true, createdAt: true, player: { select: { id: true, name: true } } },
  })
  const latest = new Map<string, { player: { id: string; name: string }; until: Date }>()
  for (const r of rows) {
    const until = new Date((r.reviewedAt ?? r.createdAt).getTime() + COOLING_OFF_DAYS * DAY_MS)
    const seen = latest.get(r.player.id)
    if (!seen || until > seen.until) latest.set(r.player.id, { player: r.player, until })
  }
  return Array.from(latest.values()).sort((a, b) => a.until.getTime() - b.until.getTime())
}

// For a profile: applied adjustments (oldest first) and any waiting one.
export async function getPlayerAdjustments(playerId: string) {
  const rows = await prisma.ratingAdjustment.findMany({
    where: { playerId, status: { in: ['approved', 'pending'] } },
    include: { requestedBy: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const applied = rows.filter(r => r.status === 'approved')
  // The history row's time is when it took effect (approval), not the request.
  const history = await prisma.pTRHistory.findMany({ where: { adjustmentId: { in: applied.map(a => a.id) } }, select: { adjustmentId: true, createdAt: true } })
  const appliedAt = new Map(history.map(h => [h.adjustmentId, h.createdAt]))
  return {
    applied: applied.map(a => ({ id: a.id, delta: a.delta, reason: a.reason, at: (appliedAt.get(a.id) ?? a.reviewedAt ?? a.createdAt).toISOString() })),
    pending: rows.find(r => r.status === 'pending') ?? null,
    coolingOffUntil: (await coolingOffUntil(prisma, playerId))?.toISOString() ?? null,
  }
}

// --- Levellers ---------------------------------------------------------------

export async function getLevellers() {
  return prisma.user.findMany({ where: { role: 'leveller' }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } })
}

export async function setLeveller(superUserId: string, target: { email?: unknown; userId?: unknown }, makeLeveller: boolean): Promise<Result> {
  if ((await getRole(superUserId)) !== 'superuser') return { error: 'Only the super user can appoint levellers' }
  const user = typeof target.userId === 'string'
    ? await prisma.user.findUnique({ where: { id: target.userId } })
    : typeof target.email === 'string' && target.email.trim()
      ? await prisma.user.findFirst({ where: { email: { equals: target.email.trim(), mode: 'insensitive' } } })
      : null
  if (!user) return { error: 'No PadelTrack account with that email' }
  if (effectiveRole(user) === 'superuser') return { error: 'That’s a super user already' }
  await prisma.user.update({ where: { id: user.id }, data: { role: makeLeveller ? 'leveller' : 'member' } })
  return { ok: true }
}
