import { prisma } from './prisma'
import { generateRoundRobinSchedule } from './round-robin'
import { computeLeaderboardPoints } from './americano'
import { calculateExpectedWin, calculateKFactor, calculateReliability } from './ptr-algorithm'

// Overall weight applied to the event's PTR effect relative to a normal
// ranked match. Same tuning as Americano — this is the same placement-based
// signal, just scored at team (not individual) granularity.
const ROUND_ROBIN_PTR_WEIGHT = 0.6
const ROUND_ROBIN_EXPECTATION_SENSITIVITY = 0.5

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
  isRanked: boolean
  seasonId: string
  teams: [string, string][]
  matches: RoundRobinMatchView[]
  ptrDeltas: Record<string, number> | null
}

export interface RoundRobinEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  target: number
  isRanked: boolean
  seasonId: string
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
  seasonId: string,
  isRanked = true
): Promise<string> {
  const fixtures = generateRoundRobinSchedule(teams)
  const event = await prisma.roundRobinEvent.create({
    data: {
      target,
      isRanked,
      seasonId,
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
    isRanked: event.isRanked,
    seasonId: event.seasonId,
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
    ptrDeltas: (event.ptrDeltas as Record<string, number> | null) ?? null,
  }
}

export async function listRoundRobinEvents(seasonId: string): Promise<RoundRobinEventSummary[]> {
  const events = await prisma.roundRobinEvent.findMany({
    where: { seasonId },
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
      isRanked: event.isRanked,
      seasonId: event.seasonId,
      teams,
      matchesComplete,
      matchesTotal: event.matches.length,
      leaderboard: teamLeaderboard(teams, points),
    }
  })
}

export async function submitRoundRobinScore(
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.roundRobinEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }
  const season = await prisma.season.findUnique({ where: { id: event.seasonId } })
  if (!season || season.status !== 'active') return { error: 'This season is closed' }

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

  await prisma.roundRobinMatch.update({
    where: { id: matchId },
    data: { teamAScore, teamBScore, status: 'complete' },
  })

  const remaining = await prisma.roundRobinMatch.count({ where: { eventId, status: 'pending' } })
  if (remaining === 0) await finalizeRoundRobinEvent(eventId)

  return { ok: true }
}

// In-progress events can be deleted freely (they've never touched PTR).
// Completed events require allowComplete — used by the admin panel — and
// reverse the PTR they applied before removing the event and its matches.
// Either way the event's season must still be active.
export async function deleteRoundRobinEvent(
  id: string,
  opts?: { allowComplete?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.roundRobinEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  const season = await prisma.season.findUnique({ where: { id: event.seasonId } })
  if (!season || season.status !== 'active') return { error: 'This season is closed' }
  if (event.status === 'complete' && !opts?.allowComplete) {
    return { error: 'Completed events can only be deleted from the admin page' }
  }

  await prisma.$transaction(async tx => {
    if (event.status === 'complete') {
      const history = await tx.pTRHistory.findMany({ where: { rrEventId: id } })
      for (const h of history) {
        await tx.playerSeason.update({
          where: { playerId_seasonId: { playerId: h.playerId, seasonId: event.seasonId } },
          data: { ptr: { decrement: h.delta } },
        })
      }
      await tx.pTRHistory.deleteMany({ where: { rrEventId: id } })
    }
    await tx.roundRobinEvent.delete({ where: { id } })
  })

  return { ok: true }
}

// Translates a completed event into PTR movement using final team standings,
// mirroring the Americano placement-based approach (margin + expectation,
// single shared K, zero-sum) but applied per team rather than per player:
//
// - Team "strength" for the expectation calc is the average PTR of its two
//   players — the same convention a normal ranked doubles match uses — so
//   both partners see the same expected-win baseline instead of each
//   drawing on their own individual PTR.
// - Both partners always played the exact same matches (same opponents,
//   same scores), so their point totals are identical by construction, and
//   both receive the exact same PTR delta — treated as one team result,
//   not split by individual contribution the way a ranked match would.
async function finalizeRoundRobinEvent(eventId: string): Promise<void> {
  const event = await prisma.roundRobinEvent.findUnique({
    where: { id: eventId },
    include: { matches: true },
  })
  if (!event || event.status === 'complete') return

  const playerSeasons = await prisma.playerSeason.findMany({
    where: { seasonId: event.seasonId, playerId: { in: event.teamPlayerIds } },
  })
  const byId = new Map(playerSeasons.map(ps => [ps.playerId, ps]))
  const points = computeLeaderboardPoints(event.matches, event.teamPlayerIds)
  const teams = chunkTeams(event.teamPlayerIds)

  const target = event.target
  const teamCount = teams.length
  const teamPoints = teams.map(([p1]) => points.get(p1) ?? 0)
  const totalPool = teamPoints.reduce((sum, v) => sum + v, 0)

  const avgK = playerSeasons.reduce(
    (sum, ps) => sum + calculateKFactor(calculateReliability(ps.matchesPlayed)),
    0
  ) / playerSeasons.length

  const teamPTR = teams.map(([p1, p2]) => {
    const a = byId.get(p1)
    const b = byId.get(p2)
    return ((a?.ptr ?? 1000) + (b?.ptr ?? 1000)) / 2
  })

  const appliedDeltas: Record<string, number> = {}

  await prisma.$transaction(async tx => {
    for (let t = 0; t < teamCount; t++) {
      const otherIdx = teams.map((_, i) => i).filter(i => i !== t)
      const myPoints = teamPoints[t]

      const avgExpectedWin = otherIdx.reduce(
        (sum, o) => sum + calculateExpectedWin(teamPTR[t], teamPTR[o]),
        0
      ) / otherIdx.length
      const expectedPoints = (avgExpectedWin / (teamCount / 2)) * totalPool
      const expectationRounds = (myPoints - expectedPoints) / target

      const marginRounds = otherIdx.reduce(
        (sum, o) => sum + Math.tanh((myPoints - teamPoints[o]) / target),
        0
      ) / otherIdx.length

      const sign = marginRounds >= 0 ? 1 : -1
      const multiplier = 1 + Math.max(
        -0.5,
        Math.min(0.5, sign * expectationRounds * ROUND_ROBIN_EXPECTATION_SENSITIVITY)
      )

      // Unranked events still play out and save normally — the PTR effect
      // is just zeroed out here (a quick multiply-by-0), same as an
      // unranked regular match.
      const rawDelta = Math.round(marginRounds * avgK * ROUND_ROBIN_PTR_WEIGHT * multiplier * 10) / 10
      const finalDelta = event.isRanked ? rawDelta : 0

      for (const playerId of teams[t]) {
        const player = byId.get(playerId)
        if (!player) continue
        appliedDeltas[playerId] = finalDelta

        await tx.playerSeason.update({
          where: { playerId_seasonId: { playerId, seasonId: event.seasonId } },
          data: { ptr: player.ptr + finalDelta },
        })
        await tx.pTRHistory.create({
          data: {
            playerId,
            matchId: null,
            rrEventId: eventId,
            seasonId: event.seasonId,
            ptrBefore: player.ptr,
            ptrAfter: player.ptr + finalDelta,
            delta: finalDelta,
            reliability: calculateReliability(player.matchesPlayed),
          },
        })
      }
    }

    await tx.roundRobinEvent.update({
      where: { id: eventId },
      data: { status: 'complete', ptrDeltas: appliedDeltas },
    })
  })
}
