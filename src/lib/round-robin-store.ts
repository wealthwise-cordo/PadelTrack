import { prisma } from './prisma'
import { generateRoundRobinSchedule } from './round-robin'
import { computeLeaderboardPoints } from './americano'
import { canManageEvent, eventsVisibleTo, type Actor } from './event-access'

export interface RoundRobinMatchView {
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

export interface RoundRobinEventView {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  target: number
  ownerId: string
  teams: [string, string][]
  matches: RoundRobinMatchView[]
}

export interface RoundRobinEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  target: number
  ownerId: string
  teams: [string, string][]
  matchesComplete: number
  matchesTotal: number
  leaderboard: { teamIndex: number; playerIds: [string, string]; points: number }[]
}

function chunkTeams(teamPlayerIds: string[]): [string, string][] {
  const teams: [string, string][] = []
  for (let i = 0; i < teamPlayerIds.length; i += 2) {
    teams.push([teamPlayerIds[i], teamPlayerIds[i + 1]])
  }
  return teams
}

function teamLeaderboard(
  teams: [string, string][],
  points: Map<string, number>
): { teamIndex: number; playerIds: [string, string]; points: number }[] {
  return teams
    .map((playerIds, teamIndex) => ({ teamIndex, playerIds, points: points.get(playerIds[0]) ?? 0 }))
    .sort((a, b) => b.points - a.points)
}

export async function createRoundRobinEvent(
  teams: [string, string][],
  target: number,
  ownerId: string
): Promise<string> {
  const fixtures = generateRoundRobinSchedule(teams)
  const event = await prisma.roundRobinEvent.create({
    data: {
      target,
      ownerId,
      teamPlayerIds: teams.flat(),
      matches: { create: fixtures.map(f => ({ ...f })) },
    },
  })
  return event.id
}

export async function getRoundRobinEvent(id: string): Promise<RoundRobinEventView | null> {
  const event = await prisma.roundRobinEvent.findUnique({
    where: { id },
    include: { matches: { orderBy: { round: 'asc' } } },
  })
  if (!event) return null

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    status: event.status as 'in_progress' | 'complete',
    target: event.target,
    ownerId: event.ownerId,
    teams: chunkTeams(event.teamPlayerIds),
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

export async function listRoundRobinEvents(actor: Actor): Promise<RoundRobinEventSummary[]> {
  const events = await prisma.roundRobinEvent.findMany({
    where: eventsVisibleTo(actor, 'teamPlayerIds'),
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const teams = chunkTeams(event.teamPlayerIds)
    const points = computeLeaderboardPoints(event.matches, event.teamPlayerIds)
    const matchesComplete = event.matches.filter(m => m.status === 'complete').length

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      target: event.target,
        ownerId: event.ownerId,
      teams,
      matchesComplete,
      matchesTotal: event.matches.length,
      leaderboard: teamLeaderboard(teams, points),
    }
  })
}

export async function submitRoundRobinScore(
  actor: Actor,
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.roundRobinEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  if (!canManageEvent(event, actor)) return { error: 'Only the organiser or players in this event can enter scores' }

  const target = event.target
  if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    return { error: 'Scores must be non-negative whole numbers' }
  }
  if (teamAScore === teamBScore) return { error: 'Round Robin matches cannot end in a tie' }
  const hi = Math.max(teamAScore, teamBScore)
  const lo = Math.min(teamAScore, teamBScore)
  if (hi !== target || lo >= target) {
    return { error: `First to ${target} — the winner's score must be ${target}, the other team's must be lower` }
  }

  const match = await prisma.roundRobinMatch.findUnique({ where: { id: matchId } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Match already recorded' }

  // Conditional on still being pending, so if two people save the same
  // match at once only the first one counts.
  const saved = await prisma.roundRobinMatch.updateMany({
    where: { id: matchId, status: 'pending' },
    data: { teamAScore, teamBScore, status: 'complete' },
  })
  if (saved.count === 0) return { error: 'Someone else already entered this score' }

  const remaining = await prisma.roundRobinMatch.count({ where: { eventId, status: 'pending' } })
  if (remaining === 0) await finalizeRoundRobinEvent(eventId)

  return { ok: true }
}

// Only the organiser can delete an event. Events never affect ratings, so
// there's nothing to reverse.
export async function deleteRoundRobinEvent(id: string, actor: Actor): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.roundRobinEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.ownerId !== actor.userId) return { error: 'Only the organiser can delete this event' }
  await prisma.roundRobinEvent.delete({ where: { id } })
  return { ok: true }
}

// Marks the event finished once its last match is in. Final standings are
// derived from the match results whenever the event is viewed.
async function finalizeRoundRobinEvent(eventId: string): Promise<void> {
  await prisma.roundRobinEvent.updateMany({ where: { id: eventId, status: 'in_progress' }, data: { status: 'complete' } })
}
