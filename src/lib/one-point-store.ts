import { prisma } from './prisma'
import { seedBracket, buildFixtures } from './one-point'
import { canManageEvent, eventsVisibleTo, type Actor } from './event-access'

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
  ownerId: string
  playerIds: string[] // bracket slot order, 8 ids
  matches: OnePointMatchView[]
}

export interface OnePointEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  ownerId: string
  playerIds: string[]
  matchesComplete: number
  matchesTotal: number
  championId: string | null
}

export async function createOnePointEvent(playerIdsByPtrDesc: string[], ownerId: string): Promise<string> {
  const bracket = seedBracket(playerIdsByPtrDesc)
  const fixtures = buildFixtures(bracket)
  const event = await prisma.onePointEvent.create({
    data: {
      ownerId,
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
    ownerId: event.ownerId,
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
  }
}

export async function listOnePointEvents(actor: Actor): Promise<OnePointEventSummary[]> {
  const events = await prisma.onePointEvent.findMany({
    where: eventsVisibleTo(actor),
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const final = event.matches.find(m => m.round === 3)
    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      ownerId: event.ownerId,
      playerIds: event.playerIds,
      matchesComplete: event.matches.filter(m => m.status === 'complete').length,
      matchesTotal: event.matches.length,
      championId: final?.status === 'complete' ? final.winnerId : null,
    }
  })
}

export async function submitOnePointWinner(
  actor: Actor,
  eventId: string,
  matchId: string,
  winnerId: string
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.onePointEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  if (!canManageEvent(event, actor)) return { error: 'Only the organiser or players in this event can enter scores' }

  const match = await prisma.onePointMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }
  if (!match.player1Id || !match.player2Id) return { error: 'Both players for this match are not yet determined' }
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    return { error: 'Winner must be one of the two players in this match' }
  }

  // Conditional on still being pending, so if two people save the same
  // match at once only the first one counts.
  const saved = await prisma.onePointMatch.updateMany({
    where: { id: matchId, status: 'pending' },
    data: { winnerId, status: 'complete' },
  })
  if (saved.count === 0) return { error: 'Someone else already entered this score' }

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

// Only the organiser can delete an event. Events never affect ratings, so
// there's nothing to reverse.
export async function deleteOnePointEvent(id: string, actor: Actor): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.onePointEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.ownerId !== actor.userId) return { error: 'Only the organiser can delete this event' }
  await prisma.onePointEvent.delete({ where: { id } })
  return { ok: true }
}

// Marks the event finished once its last match is in. Final standings are
// derived from the match results whenever the event is viewed.
async function finalizeOnePointEvent(eventId: string): Promise<void> {
  await prisma.onePointEvent.updateMany({ where: { id: eventId, status: 'in_progress' }, data: { status: 'complete' } })
}
