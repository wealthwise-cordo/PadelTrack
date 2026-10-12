import { prisma } from './prisma'
import { seedRound1, nextRoundFixtures, finalPlacements, courtNumber } from './snake-ladders'
import { canManageEvent, eventsVisibleTo, type Actor } from './event-access'

export interface SnakeLaddersMatchView {
  id: string
  round: number
  court: number // 1 = top court
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAScore: number | null
  teamBScore: number | null
  status: 'pending' | 'complete'
}

export interface SnakeLaddersEventView {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  totalRounds: number
  courts: number
  ownerId: string
  playerIds: string[]
  matches: SnakeLaddersMatchView[]
}

export interface SnakeLaddersEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  totalRounds: number
  courts: number
  ownerId: string
  playerIds: string[]
  currentRound: number
  matchesComplete: number
  matchesTotal: number
  firstPlaceIds: [string, string] | null
}

function toMatchView(m: {
  id: string; round: number; court: string
  teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string
  teamAScore: number | null; teamBScore: number | null; status: string
}): SnakeLaddersMatchView {
  return {
    id: m.id,
    round: m.round,
    court: courtNumber(m.court),
    teamAPlayer1Id: m.teamAPlayer1Id,
    teamAPlayer2Id: m.teamAPlayer2Id,
    teamBPlayer1Id: m.teamBPlayer1Id,
    teamBPlayer2Id: m.teamBPlayer2Id,
    teamAScore: m.teamAScore,
    teamBScore: m.teamBScore,
    status: m.status as 'pending' | 'complete',
  }
}

export async function createSnakeLaddersEvent(
  playerIdsByPtrDesc: string[],
  scoreMode: 'points' | 'games',
  target: number,
  totalRounds: number,
  ownerId: string,
  courts: number
): Promise<string> {
  const fixtures = seedRound1(playerIdsByPtrDesc, courts)
  const event = await prisma.snakeLaddersEvent.create({
    data: {
      scoreMode,
      target,
      totalRounds,
      courts,
      ownerId,
      playerIds: playerIdsByPtrDesc,
      matches: { create: fixtures.map(f => ({ ...f })) },
    },
  })
  return event.id
}

export async function getSnakeLaddersEvent(id: string): Promise<SnakeLaddersEventView | null> {
  const event = await prisma.snakeLaddersEvent.findUnique({
    where: { id },
    include: { matches: { orderBy: [{ round: 'asc' }, { court: 'asc' }] } },
  })
  if (!event) return null

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    status: event.status as 'in_progress' | 'complete',
    scoreMode: event.scoreMode as 'points' | 'games',
    target: event.target,
    totalRounds: event.totalRounds,
    courts: event.courts,
    ownerId: event.ownerId,
    playerIds: event.playerIds,
    matches: event.matches.map(toMatchView).sort((a, b) => a.round - b.round || a.court - b.court),
  }
}

export async function listSnakeLaddersEvents(actor: Actor): Promise<SnakeLaddersEventSummary[]> {
  const events = await prisma.snakeLaddersEvent.findMany({
    where: eventsVisibleTo(actor),
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const matchesComplete = event.matches.filter(m => m.status === 'complete').length
    const currentRound = event.matches.reduce((max, m) => Math.max(max, m.round), 1)
    const placements = finalPlacements(event.matches, event.totalRounds, event.courts)

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      scoreMode: event.scoreMode as 'points' | 'games',
      target: event.target,
      totalRounds: event.totalRounds,
      courts: event.courts,
      ownerId: event.ownerId,
      playerIds: event.playerIds,
      currentRound,
      matchesComplete,
      matchesTotal: event.totalRounds * event.courts,
      firstPlaceIds: placements ? placements[0] : null,
    }
  })
}

export async function submitSnakeLaddersScore(
  actor: Actor,
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.snakeLaddersEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  if (!canManageEvent(event, actor)) return { error: 'Only the organiser or players in this event can enter scores' }

  const target = event.target
  if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    return { error: 'Scores must be non-negative whole numbers' }
  }
  if (teamAScore === teamBScore) return { error: 'Matches cannot end in a tie' }
  const hi = Math.max(teamAScore, teamBScore)
  const lo = Math.min(teamAScore, teamBScore)
  if (hi !== target || lo >= target) {
    return { error: `First to ${target} — the winner's score must be ${target}, the other team's must be lower` }
  }

  const match = await prisma.snakeLaddersMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }

  // Conditional on still being pending, so if two people save the same
  // match at once only the first one counts.
  const saved = await prisma.snakeLaddersMatch.updateMany({
    where: { id: matchId, status: 'pending' },
    data: { teamAScore, teamBScore, status: 'complete' },
  })
  if (saved.count === 0) return { error: 'Someone else already entered this score' }

  const roundMatches = await prisma.snakeLaddersMatch.findMany({ where: { eventId, round: match.round } })
  const roundComplete = roundMatches.length === event.courts && roundMatches.every(m => m.status === 'complete')

  if (roundComplete) {
    if (match.round >= event.totalRounds) {
      await finalizeSnakeLaddersEvent(eventId)
    } else {
      const byCourt = [...roundMatches].sort((a, b) => courtNumber(a.court) - courtNumber(b.court))
      if (byCourt.every(m => m.teamAScore !== null && m.teamBScore !== null)) {
        const fixtures = nextRoundFixtures(
          match.round + 1,
          byCourt.map(m => ({ ...m, teamAScore: m.teamAScore!, teamBScore: m.teamBScore! }))
        )
        await prisma.snakeLaddersMatch.createMany({ data: fixtures.map(f => ({ eventId, ...f })), skipDuplicates: true })
      }
    }
  }

  return { ok: true }
}

// Only the organiser can delete an event. Events never affect ratings, so
// there's nothing to reverse.
export async function deleteSnakeLaddersEvent(id: string, actor: Actor): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.snakeLaddersEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.ownerId !== actor.userId) return { error: 'Only the organiser can delete this event' }
  await prisma.snakeLaddersEvent.delete({ where: { id } })
  return { ok: true }
}

// Marks the event finished once its last match is in. Final standings are
// derived from the match results whenever the event is viewed.
async function finalizeSnakeLaddersEvent(eventId: string): Promise<void> {
  await prisma.snakeLaddersEvent.updateMany({ where: { id: eventId, status: 'in_progress' }, data: { status: 'complete' } })
}
