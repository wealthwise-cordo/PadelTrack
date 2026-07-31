import { prisma } from './prisma'
import { seedBracket, buildFixtures } from './one-point'
import { calculateExpectedWin, calculateKFactor, calculateReliability } from './ptr-algorithm'

// Overall weight applied to the tournament's PTR effect — much lighter
// than a ranked match or the other events, since a single point per round
// is a noisy, low-information result.
const ONE_POINT_PTR_WEIGHT = 0.25
// How much beating/missing pre-tournament expectation can amplify or
// dampen the fixed-tier placement delta (clamped to a 0.5x-1.5x
// multiplier) for the champion, runner-up, and quarterfinal-loser tiers.
const ONE_POINT_EXPECTATION_SENSITIVITY = 1

export interface OnePointMatchView {
  id: string
  round: number
  position: number
  sequence: number
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  status: 'pending' | 'complete'
}

export interface OnePointEventView {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  playerIds: string[] // bracket slot order, 8 ids
  matches: OnePointMatchView[]
  ptrDeltas: Record<string, number> | null
}

export interface OnePointEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  playerIds: string[]
  matchesComplete: number
  matchesTotal: number
  championId: string | null
}

export async function createOnePointEvent(playerIdsByPtrDesc: string[]): Promise<string> {
  const bracket = seedBracket(playerIdsByPtrDesc)
  const fixtures = buildFixtures(bracket)
  const event = await prisma.onePointEvent.create({
    data: {
      playerIds: bracket,
      matches: { create: fixtures.map(f => ({ ...f })) },
    },
  })
  return event.id
}

export async function getOnePointEvent(id: string): Promise<OnePointEventView | null> {
  const event = await prisma.onePointEvent.findUnique({
    where: { id },
    include: { matches: { orderBy: { sequence: 'asc' } } },
  })
  if (!event) return null

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    status: event.status as 'in_progress' | 'complete',
    playerIds: event.playerIds,
    matches: event.matches.map(m => ({
      id: m.id,
      round: m.round,
      position: m.position,
      sequence: m.sequence,
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      winnerId: m.winnerId,
      status: m.status as 'pending' | 'complete',
    })),
    ptrDeltas: (event.ptrDeltas as Record<string, number> | null) ?? null,
  }
}

export async function listOnePointEvents(): Promise<OnePointEventSummary[]> {
  const events = await prisma.onePointEvent.findMany({
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const final = event.matches.find(m => m.round === 3)
    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      playerIds: event.playerIds,
      matchesComplete: event.matches.filter(m => m.status === 'complete').length,
      matchesTotal: event.matches.length,
      championId: final?.status === 'complete' ? final.winnerId : null,
    }
  })
}

export async function submitOnePointWinner(
  eventId: string,
  matchId: string,
  winnerId: string
): Promise<{ ok: true } | { error: string }> {
  const match = await prisma.onePointMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }
  if (!match.player1Id || !match.player2Id) return { error: 'Both players for this match are not yet determined' }
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    return { error: 'Winner must be one of the two players in this match' }
  }

  await prisma.onePointMatch.update({
    where: { id: matchId },
    data: { winnerId, status: 'complete' },
  })

  if (match.round < 3) {
    const nextRound = match.round + 1
    const nextPosition = Math.ceil(match.position / 2)
    const feederPositions: [number, number] =
      match.position % 2 === 1 ? [match.position, match.position + 1] : [match.position - 1, match.position]

    const feeders = await prisma.onePointMatch.findMany({
      where: { eventId, round: match.round, position: { in: feederPositions } },
    })
    const feederA = feeders.find(f => f.position === feederPositions[0])
    const feederB = feeders.find(f => f.position === feederPositions[1])

    if (feederA?.status === 'complete' && feederB?.status === 'complete') {
      await prisma.onePointMatch.updateMany({
        where: { eventId, round: nextRound, position: nextPosition },
        data: { player1Id: feederA.winnerId, player2Id: feederB.winnerId },
      })
    }
  } else {
    await finalizeOnePointEvent(eventId)
  }

  return { ok: true }
}

// In-progress events can be deleted freely (they've never touched PTR).
// Completed events require allowComplete — used by the admin panel — and
// reverse the PTR they applied before removing the event and its matches.
export async function deleteOnePointEvent(
  id: string,
  opts?: { allowComplete?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.onePointEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.status === 'complete' && !opts?.allowComplete) {
    return { error: 'Completed events can only be deleted from the admin page' }
  }

  await prisma.$transaction(async tx => {
    if (event.status === 'complete') {
      const history = await tx.pTRHistory.findMany({ where: { opEventId: id } })
      for (const h of history) {
        await tx.player.update({
          where: { id: h.playerId },
          data: { ptr: { decrement: h.delta } },
        })
      }
      await tx.pTRHistory.deleteMany({ where: { opEventId: id } })
    }
    await tx.onePointEvent.delete({ where: { id } })
  })

  return { ok: true }
}

// Translates a completed bracket into PTR movement based on final
// placement tier, using a much lighter weight (0.25) than a ranked match
// or the other events, and a single shared K — the average of every
// participant's own reliability-based K-factor — so the tournament stays
// roughly zero-sum regardless of the mix of new vs established players.
//
// Each tier gets a fixed base placement margin; expectation (this
// player's average Elo win-probability against the other 7, centred on
// 0) can only scale that margin's magnitude 0.5x-1.5x — never flip its
// sign — so the champion and runner-up always gain PTR and quarterfinal
// losers always lose it. The two semifinal losers are the exception: their
// base margin is 0, so their delta is driven entirely by expectation and
// can land on either side depending on whether they over- or
// under-performed their pre-tournament strength.
async function finalizeOnePointEvent(eventId: string): Promise<void> {
  const event = await prisma.onePointEvent.findUnique({
    where: { id: eventId },
    include: { matches: true },
  })
  if (!event || event.status === 'complete') return

  const players = await prisma.player.findMany({ where: { id: { in: event.playerIds } } })
  const byId = new Map(players.map(p => [p.id, p]))

  const final = event.matches.find(m => m.round === 3)!
  const semis = event.matches.filter(m => m.round === 2)
  const quarters = event.matches.filter(m => m.round === 1)

  const championId = final.winnerId!
  const runnerUpId = (final.player1Id === championId ? final.player2Id : final.player1Id)!
  const semiLoserIds = semis.map(m => (m.player1Id === m.winnerId ? m.player2Id! : m.player1Id!))
  const quarterLoserIds = quarters.map(m => (m.player1Id === m.winnerId ? m.player2Id! : m.player1Id!))

  const avgK = players.reduce(
    (sum, p) => sum + calculateKFactor(calculateReliability(p.matchesPlayed)),
    0
  ) / players.length

  const expectationRounds = (playerId: string): number => {
    const player = byId.get(playerId)!
    const others = event.playerIds.filter(id => id !== playerId)
    const avgExpectedWin = others.reduce((sum, otherId) => {
      const other = byId.get(otherId)
      return other ? sum + calculateExpectedWin(player.ptr, other.ptr) : sum
    }, 0) / others.length
    return avgExpectedWin - 0.5
  }

  // base === 0 (semifinal losers) means the margin comes entirely from
  // expectation, sign included. Otherwise expectation only scales the
  // fixed-sign base by 0.5x-1.5x.
  const marginFor = (playerId: string, base: number): number => {
    if (base === 0) return expectationRounds(playerId)
    const sign = base >= 0 ? 1 : -1
    const multiplier = 1 + Math.max(
      -0.5,
      Math.min(0.5, sign * expectationRounds(playerId) * ONE_POINT_EXPECTATION_SENSITIVITY)
    )
    return base * multiplier
  }

  const tiers: [string, number][] = [
    [championId, 1.0],
    [runnerUpId, 0.5],
    ...semiLoserIds.map((id): [string, number] => [id, 0]),
    ...quarterLoserIds.map((id): [string, number] => [id, -0.5]),
  ]

  const appliedDeltas: Record<string, number> = {}

  await prisma.$transaction(async tx => {
    for (const [playerId, base] of tiers) {
      const player = byId.get(playerId)
      if (!player) continue

      const margin = marginFor(playerId, base)
      const finalDelta = Math.round(margin * avgK * ONE_POINT_PTR_WEIGHT * 10) / 10
      appliedDeltas[playerId] = finalDelta

      await tx.player.update({
        where: { id: playerId },
        data: { ptr: player.ptr + finalDelta },
      })
      await tx.pTRHistory.create({
        data: {
          playerId,
          matchId: null,
          opEventId: eventId,
          ptrBefore: player.ptr,
          ptrAfter: player.ptr + finalDelta,
          delta: finalDelta,
          reliability: calculateReliability(player.matchesPlayed),
        },
      })
    }
    await tx.onePointEvent.update({
      where: { id: eventId },
      data: { status: 'complete', ptrDeltas: appliedDeltas },
    })
  })
}
