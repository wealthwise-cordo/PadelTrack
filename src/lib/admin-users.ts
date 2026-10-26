import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { getRole } from '@/lib/roles'
import { internalFromLevel, isLtaLevel } from '@/lib/lta'
import { AUTO_CONFIRM_HOURS, settleMatchesFor } from '@/lib/store'

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
