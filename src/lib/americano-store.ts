import { prisma } from './prisma'
import { generateAmericanoSchedule, computeLeaderboardPoints } from './americano'
import { calculateExpectedWin, calculateKFactor, calculateReliability } from './ptr-algorithm'

// Overall weight applied to the event's PTR effect relative to a normal
// ranked match.
const AMERICANO_PTR_WEIGHT = 0.6
// How much beating/missing your pre-event expectation can amplify or
// dampen the placement-driven delta (clamped to a 0.5x-1.5x multiplier).
const AMERICANO_EXPECTATION_SENSITIVITY = 0.5

export interface AmericanoMatchView {
  id: string
  round: number
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAScore: number | null
  teamBScore: number | null
  status: 'pending' | 'complete'
}

export interface AmericanoEventView {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  isRanked: boolean
  playerIds: string[]
  matches: AmericanoMatchView[]
  ptrDeltas: Record<string, number> | null
}

export interface AmericanoEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  isRanked: boolean
  playerIds: string[]
  matchesComplete: number
  matchesTotal: number
  leaderboard: { playerId: string; points: number }[]
}

export async function createAmericanoEvent(
  playerIds: string[],
  scoreMode: 'points' | 'games',
  target: number,
  isRanked = true
): Promise<string> {
  const fixtures = generateAmericanoSchedule(playerIds)
  const event = await prisma.americanoEvent.create({
    data: {
      scoreMode,
      target,
      isRanked,
      playerIds,
      matches: { create: fixtures.map(f => ({ ...f })) },
    },
  })
  return event.id
}

export async function getAmericanoEvent(id: string): Promise<AmericanoEventView | null> {
  const event = await prisma.americanoEvent.findUnique({
    where: { id },
    include: { matches: { orderBy: { round: 'asc' } } },
  })
  if (!event) return null

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    status: event.status as 'in_progress' | 'complete',
    scoreMode: event.scoreMode as 'points' | 'games',
    target: event.target,
    isRanked: event.isRanked,
    playerIds: event.playerIds,
    matches: event.matches.map(m => ({
      id: m.id,
      round: m.round,
      teamAPlayer1Id: m.teamAPlayer1Id,
      teamAPlayer2Id: m.teamAPlayer2Id,
      teamBPlayer1Id: m.teamBPlayer1Id,
      teamBPlayer2Id: m.teamBPlayer2Id,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      status: m.status as 'pending' | 'complete',
    })),
    ptrDeltas: (event.ptrDeltas as Record<string, number> | null) ?? null,
  }
}

export async function listAmericanoEvents(): Promise<AmericanoEventSummary[]> {
  const events = await prisma.americanoEvent.findMany({
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const points = computeLeaderboardPoints(event.matches, event.playerIds)
    const matchesComplete = event.matches.filter(m => m.status === 'complete').length

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      scoreMode: event.scoreMode as 'points' | 'games',
      target: event.target,
      isRanked: event.isRanked,
      playerIds: event.playerIds,
      matchesComplete,
      matchesTotal: event.matches.length,
      leaderboard: event.playerIds
        .map(playerId => ({ playerId, points: points.get(playerId) ?? 0 }))
        .sort((a, b) => b.points - a.points),
    }
  })
}

export async function submitAmericanoScore(
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  if (teamAScore === teamBScore) return { error: 'Americano matches cannot end in a tie' }

  const event = await prisma.americanoEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  if (teamAScore + teamBScore !== event.target) {
    return { error: `Scores must add up to ${event.target}` }
  }

  const match = await prisma.americanoMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }

  await prisma.americanoMatch.update({
    where: { id: matchId },
    data: { teamAScore, teamBScore, status: 'complete' },
  })

  const remaining = await prisma.americanoMatch.count({ where: { eventId, status: 'pending' } })
  if (remaining === 0) await finalizeAmericanoEvent(eventId)

  return { ok: true }
}

// In-progress events can be deleted freely (they've never touched PTR).
// Completed events require allowComplete — used by the admin panel — and
// reverse the PTR they applied before removing the event and its matches.
export async function deleteAmericanoEvent(
  id: string,
  opts?: { allowComplete?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.americanoEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.status === 'complete' && !opts?.allowComplete) {
    return { error: 'Completed events can only be deleted from the admin page' }
  }

  await prisma.$transaction(async tx => {
    if (event.status === 'complete') {
      const history = await tx.pTRHistory.findMany({ where: { eventId: id } })
      for (const h of history) {
        await tx.player.update({
          where: { id: h.playerId },
          data: { ptr: { decrement: h.delta } },
        })
      }
      await tx.pTRHistory.deleteMany({ where: { eventId: id } })
    }
    await tx.americanoEvent.delete({ where: { id } })
  })

  return { ok: true }
}

// Translates a completed event into PTR movement using final standings
// rather than per-match results:
//
// - "marginRounds" is the placement signal: each player's average, capped
//   (tanh) point margin against every other participant, in units of the
//   round target. This is what actually drives the sign of the delta — 1st
//   place is always positive, last place always negative, and a close
//   finish among the tail is punished far more gently than a blowout,
//   since saturating margins against nearby opponents stay small.
// - "expectationRounds" is how many rounds' worth of points a player
//   scored above/below what their pre-event PTR predicted, via the same
//   Elo expected-win formula used for ranked matches.
// - Expectation can only scale marginRounds's magnitude up or down
//   (0.5x-1.5x) — it can never flip its sign, so finishing 1st always
//   raises PTR and finishing last always lowers it, regardless of whether
//   the result matched expectations.
// - A single shared K for the whole event — the average of every
//   participant's own reliability-based K-factor — plus AMERICANO_PTR_WEIGHT
//   bring it down to an appropriately sized swing. Using one shared K
//   (rather than each player's own) keeps the event's total PTR movement
//   zero-sum regardless of the mix of new vs established players.
//
// Win/loss records, streaks, and matchesPlayed are left untouched — this
// is a lightweight signal, not a ranked result.
async function finalizeAmericanoEvent(eventId: string): Promise<void> {
  const event = await prisma.americanoEvent.findUnique({
    where: { id: eventId },
    include: { matches: true },
  })
  if (!event || event.status === 'complete') return

  const players = await prisma.player.findMany({ where: { id: { in: event.playerIds } } })
  const byId = new Map(players.map(p => [p.id, p]))
  const points = computeLeaderboardPoints(event.matches, event.playerIds)

  const target = event.target
  const N = event.playerIds.length
  const totalPool = Array.from(points.values()).reduce((sum, v) => sum + v, 0)

  // One shared K for the whole event — the average of every participant's
  // own reliability-based K-factor — rather than each player using their
  // own. Keeps the event's total PTR movement zero-sum regardless of who's
  // new vs established.
  const avgK = players.reduce(
    (sum, p) => sum + calculateKFactor(calculateReliability(p.matchesPlayed)),
    0
  ) / players.length

  const appliedDeltas: Record<string, number> = {}

  await prisma.$transaction(async tx => {
    for (const playerId of event.playerIds) {
      const player = byId.get(playerId)
      if (!player) continue

      const others = event.playerIds.filter(id => id !== playerId)
      const myPoints = points.get(playerId) ?? 0

      const avgExpectedWin = others.reduce((sum, otherId) => {
        const other = byId.get(otherId)
        return other ? sum + calculateExpectedWin(player.ptr, other.ptr) : sum
      }, 0) / others.length
      const expectedPoints = (avgExpectedWin / (N / 2)) * totalPool
      const expectationRounds = (myPoints - expectedPoints) / target

      const marginRounds = others.reduce((sum, otherId) => {
        const otherPoints = points.get(otherId) ?? 0
        return sum + Math.tanh((myPoints - otherPoints) / target)
      }, 0) / others.length

      const sign = marginRounds >= 0 ? 1 : -1
      const multiplier = 1 + Math.max(
        -0.5,
        Math.min(0.5, sign * expectationRounds * AMERICANO_EXPECTATION_SENSITIVITY)
      )

      // Unranked events still play out and save normally — the PTR effect
      // is just zeroed out here (a quick multiply-by-0), same as an
      // unranked regular match.
      const rawDelta = Math.round(marginRounds * avgK * AMERICANO_PTR_WEIGHT * multiplier * 10) / 10
      const finalDelta = event.isRanked ? rawDelta : 0
      appliedDeltas[playerId] = finalDelta

      await tx.player.update({
        where: { id: playerId },
        data: { ptr: player.ptr + finalDelta },
      })
      await tx.pTRHistory.create({
        data: {
          playerId,
          matchId: null,
          eventId,
          ptrBefore: player.ptr,
          ptrAfter: player.ptr + finalDelta,
          delta: finalDelta,
          reliability: calculateReliability(player.matchesPlayed),
        },
      })
    }
    await tx.americanoEvent.update({
      where: { id: eventId },
      data: { status: 'complete', ptrDeltas: appliedDeltas },
    })
  })
}
