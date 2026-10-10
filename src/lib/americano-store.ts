import { prisma } from './prisma'
import { generateAmericanoSchedule, computeLeaderboardPoints } from './americano'
import { canManageEvent, eventsVisibleTo, type Actor } from './event-access'

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
  ownerId: string
  playerIds: string[]
  matches: AmericanoMatchView[]
}

export interface AmericanoEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  ownerId: string
  playerIds: string[]
  matchesComplete: number
  matchesTotal: number
  leaderboard: { playerId: string; points: number }[]
}

export async function createAmericanoEvent(
  playerIds: string[],
  scoreMode: 'points' | 'games',
  target: number,
  ownerId: string
): Promise<string> {
  const fixtures = generateAmericanoSchedule(playerIds)
  const event = await prisma.americanoEvent.create({
    data: {
      scoreMode,
      target,
      ownerId,
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
    ownerId: event.ownerId,
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
  }
}

export async function listAmericanoEvents(actor: Actor): Promise<AmericanoEventSummary[]> {
  const events = await prisma.americanoEvent.findMany({
    where: eventsVisibleTo(actor),
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
        ownerId: event.ownerId,
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
  actor: Actor,
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  if (teamAScore === teamBScore) return { error: 'Americano matches cannot end in a tie' }

  const event = await prisma.americanoEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  if (!canManageEvent(event, actor)) return { error: 'Only the organiser or players in this event can enter scores' }
  if (teamAScore + teamBScore !== event.target) {
    return { error: `Scores must add up to ${event.target}` }
  }

  const match = await prisma.americanoMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }

  // Conditional on still being pending, so if two people save the same
  // match at once only the first one counts.
  const saved = await prisma.americanoMatch.updateMany({
    where: { id: matchId, status: 'pending' },
    data: { teamAScore, teamBScore, status: 'complete' },
  })
  if (saved.count === 0) return { error: 'Someone else already entered this score' }

  const remaining = await prisma.americanoMatch.count({ where: { eventId, status: 'pending' } })
  if (remaining === 0) await finalizeAmericanoEvent(eventId)

  return { ok: true }
}

// Only the organiser can delete an event. Events never affect ratings, so
// there's nothing to reverse.
export async function deleteAmericanoEvent(id: string, actor: Actor): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.americanoEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.ownerId !== actor.userId) return { error: 'Only the organiser can delete this event' }
  await prisma.americanoEvent.delete({ where: { id } })
  return { ok: true }
}

// Marks the event finished once its last match is in. Final standings are
// derived from the match results whenever the event is viewed.
async function finalizeAmericanoEvent(eventId: string): Promise<void> {
  await prisma.americanoEvent.updateMany({ where: { id: eventId, status: 'in_progress' }, data: { status: 'complete' } })
}
