import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { getRole } from '@/lib/roles'
import { internalFromLevel, isLtaLevel } from '@/lib/lta'
import { AUTO_CONFIRM_HOURS, settleMatchesFor } from '@/lib/store'
import type { Prisma } from '@prisma/client'

// Ranked guests — temporary, while few players are on PadelTrack. The super
// user verifies a guest who's holding up a ranked match and sets their level.
// From then on their ranked matches count without them joining: they're
// rated, but stay out of circles and rankings, and nobody can open their
// full profile. If they join later, they keep that rating and history.

type Result = { ok: true } | { error: string }
const WINDOW_MS = AUTO_CONFIRM_HOURS * 3_600_000
const guestWhere = { userId: null, deletedAt: null }

// Guests in pending ranked matches, who'd otherwise turn those matches into
// friendlies. Soonest deadline first.
export async function getGuestsAwaitingJoin() {
  const matches = await prisma.match.findMany({
    where: { status: 'pending', isRanked: true },
    select: {
      submittedAt: true,
      teamAPlayer1: { include: { createdBy: { select: { name: true } } } },
      teamAPlayer2: { include: { createdBy: { select: { name: true } } } },
      teamBPlayer1: { include: { createdBy: { select: { name: true } } } },
      teamBPlayer2: { include: { createdBy: { select: { name: true } } } },
    },
  })
  const byId = new Map<string, { id: string; name: string; suggestedLevel: number | null; addedBy: string | null; matches: number; deadline: Date }>()
  for (const m of matches) {
    const deadline = new Date(m.submittedAt.getTime() + WINDOW_MS)
    for (const p of [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]) {
      if (p.userId || p.deletedAt || p.rankedGuestAt) continue
      const seen = byId.get(p.id)
      if (seen) {
        seen.matches++
        if (deadline < seen.deadline) seen.deadline = deadline
      } else {
        byId.set(p.id, { id: p.id, name: p.name, suggestedLevel: p.suggestedLevel, addedBy: p.createdBy?.name ?? null, matches: 1, deadline })
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
}

export async function getRankedGuests() {
  return prisma.player.findMany({
    where: { ...guestWhere, rankedGuestAt: { not: null } },
    select: { id: true, name: true, ptr: true, matchesPlayed: true, rankedGuestAt: true, createdBy: { select: { name: true } } },
    orderBy: { rankedGuestAt: 'desc' },
  })
}

export async function verifyGuest(userId: string, playerId: string, level: unknown): Promise<Result> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Only the super user can do this' }
  if (!isLtaLevel(level)) return { error: 'Pick a level' }
  const guest = await prisma.player.findFirst({ where: { id: playerId, ...guestWhere } })
  if (!guest) return { error: 'That guest wasn’t found — they may have joined already' }
  if (guest.rankedGuestAt) return { error: 'This guest is already verified' }

  const updated = await prisma.player.updateMany({
    where: { id: playerId, ...guestWhere, rankedGuestAt: null },
    data: {
      rankedGuestAt: new Date(),
      rankedGuestById: userId,
      startingLevel: level,
      // Reliability stays at its starting low, so early results settle it.
      ...(guest.matchesPlayed === 0 && { ptr: internalFromLevel(level) }),
    },
  })
  if (updated.count === 0) return { error: 'This guest changed — refresh and try again' }
  await prisma.adminUserAction.create({
    data: {
      action: 'verify', byId: userId,
      summary: `Verified ${guest.name} as a ranked guest at level ${level.toFixed(1)}`,
      detail: { playerId, level, ptrBefore: guest.ptr },
    },
  })
  // Their confirmed matches can become ranked now.
  await settleMatchesFor(playerId)
  if (guest.createdById) {
    await sendPush([guest.createdById], {
      title: `${guest.name.split(' ')[0]} now counts in ranked matches`,
      body: 'PadelTrack admin verified them, so your ranked matches with them count without them joining.',
      url: '/matches',
    })
  }
  return { ok: true }
}

// --- Duplicates ----------------------------------------------------------------
//
// Guests are found through your circle's matches when adding players, so one
// person is only added twice by people with no circle in common. Those
// copies, and a guest who's the same as a registered player, are offered here
// when their names are at least 90% alike, to merge or dismiss.

export const DUPLICATE_THRESHOLD = 0.9

const normalise = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// 1 for the same name, falling with each letter added, removed or changed
// (Levenshtein distance over the longer name's length).
export function nameSimilarity(a: string, b: string): number {
  const x = normalise(a)
  const y = normalise(b)
  if (!x.length && !y.length) return 1
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const row = [i]
    for (let j = 1; j <= y.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length)
}

const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string]

const seats = (id: string) => [{ teamAPlayer1Id: id }, { teamAPlayer2Id: id }, { teamBPlayer1Id: id }, { teamBPlayer2Id: id }]

// Why keep can't absorb remove, or null if it can.
type Mergeable = { id: string; userId: string | null; deletedAt: Date | null; matchesPlayed: number }

// Confirmed ranked results: rating changes, or an incomplete match's stats.
const hasResults = async (p: Mergeable) =>
  p.matchesPlayed > 0 || (await prisma.pTRHistory.count({ where: { playerId: p.id, matchId: { not: null } } })) > 0

async function mergeBlocker(keep: Mergeable, remove: Mergeable): Promise<string | null> {
  if (remove.userId || remove.deletedAt) return 'Only a guest can be merged into someone else'
  if (keep.deletedAt) return 'That player’s account was deleted'
  const [keepHistory, removeHistory, together, eventsTogether] = await Promise.all([
    hasResults(keep),
    hasResults(remove),
    prisma.match.count({ where: { AND: [{ OR: seats(keep.id) }, { OR: seats(remove.id) }] } }),
    Promise.all([
      prisma.americanoEvent.count({ where: { playerIds: { hasEvery: [keep.id, remove.id] } } }),
      prisma.roundRobinEvent.count({ where: { teamPlayerIds: { hasEvery: [keep.id, remove.id] } } }),
      prisma.snakeLaddersEvent.count({ where: { playerIds: { hasEvery: [keep.id, remove.id] } } }),
    ]).then(c => c.reduce((a, b) => a + b, 0)),
  ])
  if (keepHistory && removeHistory) return 'Both have ranked results, so their ratings can’t be combined'
  if (together) return 'They played in the same match, so they’re different people'
  if (eventsTogether) return 'They’re both in the same event'
  return null
}

export async function getDuplicateCandidates() {
  const [players, dismissed] = await Promise.all([
    prisma.player.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, userId: true, deletedAt: true, rankedGuestAt: true, matchesPlayed: true, ptr: true, createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.duplicateDismissal.findMany({ select: { playerAId: true, playerBId: true } }),
  ])
  const skip = new Set(dismissed.map(d => `${d.playerAId}|${d.playerBId}`))
  const pairs: { a: (typeof players)[number]; b: (typeof players)[number]; similarity: number }[] = []
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]
      const b = players[j]
      if (a.userId && b.userId) continue
      const la = normalise(a.name).length
      const lb = normalise(b.name).length
      // Too different in length to reach the threshold.
      if (Math.abs(la - lb) > (1 - DUPLICATE_THRESHOLD) * Math.max(la, lb)) continue
      const [x, y] = pairKey(a.id, b.id)
      if (skip.has(`${x}|${y}`)) continue
      const similarity = nameSimilarity(a.name, b.name)
      if (similarity >= DUPLICATE_THRESHOLD) pairs.push({ a, b, similarity })
    }
  }
  pairs.sort((p, q) => q.similarity - p.similarity)

  const describe = async (p: (typeof players)[number]) => ({
    id: p.id,
    name: p.name,
    kind: p.userId ? 'Registered' : p.rankedGuestAt ? 'Ranked guest' : 'Guest',
    rated: !!p.userId || !!p.rankedGuestAt,
    ptr: p.ptr,
    addedBy: p.createdBy?.name ?? null,
    createdAt: p.createdAt.toISOString(),
    matches: await prisma.match.count({ where: { OR: seats(p.id) } }),
    rankedMatches: p.matchesPlayed,
  })
  return Promise.all(pairs.map(async ({ a, b, similarity }) => ({
    similarity,
    a: await describe(a),
    b: await describe(b),
    // Keeping a means b is merged into it, and the other way round.
    keepA: await mergeBlocker(a, b),
    keepB: await mergeBlocker(b, a),
  })))
}

const RATING_FIELDS = [
  'ptr', 'reliability', 'lastRankedPlayedAt', 'matchesPlayed', 'wins', 'losses', 'setsWon', 'setsLost',
  'gamesWon', 'gamesLost', 'tiebreaksWon', 'tiebreaksPlayed', 'currentStreak', 'bestStreak',
] as const

// Moves everything of `removeId`'s onto `keepId` and deletes it: matches,
// events, rating history. If only the removed guest has ranked results, the
// kept player takes over their rating and stats. The removed guest's invite
// link stops working.
export async function mergePlayers(userId: string, keepId: unknown, removeId: unknown): Promise<Result> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Only the super user can do this' }
  if (typeof keepId !== 'string' || typeof removeId !== 'string' || keepId === removeId) return { error: 'Pick two different players' }
  const [keep, remove] = await Promise.all([
    prisma.player.findUnique({ where: { id: keepId } }),
    prisma.player.findUnique({ where: { id: removeId } }),
  ])
  if (!keep || !remove) return { error: 'One of these players wasn’t found — refresh and try again' }
  const blocked = await mergeBlocker(keep, remove)
  if (blocked) return { error: blocked }
  const removeHasResults = await hasResults(remove)

  await prisma.$transaction(async tx => {
    const swap = async (model: 'match' | 'americanoMatch' | 'roundRobinMatch' | 'snakeLaddersMatch') => {
      for (const field of ['teamAPlayer1Id', 'teamAPlayer2Id', 'teamBPlayer1Id', 'teamBPlayer2Id'] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx[model] as any).updateMany({ where: { [field]: remove.id }, data: { [field]: keep.id } })
      }
    }
    await swap('match')
    await swap('americanoMatch')
    await swap('roundRobinMatch')
    await swap('snakeLaddersMatch')
    await tx.roundRobinMatch.updateMany({ where: { submittedById: remove.id }, data: { submittedById: keep.id } })
    const replace = (ids: string[]) => ids.map(id => (id === remove.id ? keep.id : id))
    for (const e of await tx.americanoEvent.findMany({ where: { playerIds: { has: remove.id } } })) {
      await tx.americanoEvent.update({ where: { id: e.id }, data: { playerIds: replace(e.playerIds) } })
    }
    for (const e of await tx.roundRobinEvent.findMany({ where: { teamPlayerIds: { has: remove.id } } })) {
      await tx.roundRobinEvent.update({ where: { id: e.id }, data: { teamPlayerIds: replace(e.teamPlayerIds) } })
    }
    for (const e of await tx.snakeLaddersEvent.findMany({ where: { playerIds: { has: remove.id } } })) {
      await tx.snakeLaddersEvent.update({ where: { id: e.id }, data: { playerIds: replace(e.playerIds) } })
    }
    await tx.pTRHistory.updateMany({ where: { playerId: remove.id }, data: { playerId: keep.id } })
    await tx.ratingAdjustment.updateMany({ where: { playerId: remove.id }, data: { playerId: keep.id } })

    const data: Prisma.PlayerUpdateInput = { suggestedLevel: keep.suggestedLevel ?? remove.suggestedLevel }
    if (removeHasResults) for (const f of RATING_FIELDS) (data as Record<string, unknown>)[f] = remove[f]
    // A guest kept in place of a ranked guest becomes one, at that level.
    if (!keep.userId && remove.rankedGuestAt && !keep.rankedGuestAt) {
      Object.assign(data, { rankedGuestAt: remove.rankedGuestAt, rankedGuestById: remove.rankedGuestById, startingLevel: remove.startingLevel })
      if (!removeHasResults && remove.startingLevel !== null) data.ptr = internalFromLevel(remove.startingLevel)
    }
    await tx.player.update({ where: { id: keep.id }, data })
    const kind = (p: { userId: string | null; rankedGuestAt: Date | null }) => (p.userId ? 'registered' : p.rankedGuestAt ? 'ranked guest' : 'guest')
    await tx.adminUserAction.create({
      data: {
        action: 'merge', byId: userId,
        summary: `Merged ${remove.name} (${kind(remove)}) into ${keep.name} (${kind(keep)})${removeHasResults ? ', taking over their rating' : ''}`,
        // The deleted guest as it was, since nothing else keeps it.
        detail: { keepId: keep.id, removed: JSON.parse(JSON.stringify(remove)), tookOverRating: removeHasResults },
      },
    })
    await tx.duplicateDismissal.deleteMany({ where: { OR: [{ playerAId: remove.id }, { playerBId: remove.id }] } })
    await tx.player.delete({ where: { id: remove.id } })
  }, { timeout: 20_000 })
  // Pending matches may now be able to become ranked (a registered or ranked
  // player in place of a guest).
  await settleMatchesFor(keep.id)
  return { ok: true }
}

export async function dismissDuplicate(userId: string, aId: unknown, bId: unknown): Promise<Result> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Only the super user can do this' }
  if (typeof aId !== 'string' || typeof bId !== 'string' || aId === bId) return { error: 'Pick two different players' }
  const [playerAId, playerBId] = pairKey(aId, bId)
  const names = await prisma.player.findMany({ where: { id: { in: [playerAId, playerBId] } }, select: { name: true } })
  if (names.length !== 2) return { error: 'One of these players wasn’t found — refresh and try again' }
  await prisma.duplicateDismissal.upsert({
    where: { playerAId_playerBId: { playerAId, playerBId } },
    create: { playerAId, playerBId, byId: userId },
    update: {},
  })
  await prisma.adminUserAction.create({
    data: { action: 'dismiss', byId: userId, summary: `Marked ${names[0].name} and ${names[1].name} as different people`, detail: { playerAId, playerBId } },
  })
  return { ok: true }
}

export async function getUserActionLog(take = 30) {
  return prisma.adminUserAction.findMany({ orderBy: { createdAt: 'desc' }, take, include: { by: { select: { name: true } } } })
}
