import { prisma } from './prisma'
import { seedRound1, nextRoundFixtures, finalPlacements } from './snake-ladders'
import { calculateExpectedWin, calculateKFactor, calculateReliability } from './ptr-algorithm'

// Overall weight applied to the event's PTR effect relative to a normal
// ranked match — same tuning as Round Robin, since this reuses its exact
// margin+expectation formula, just fed placement tiers instead of
// accumulated match points.
const SNAKE_LADDERS_PTR_WEIGHT = 0.6
const SNAKE_LADDERS_EXPECTATION_SENSITIVITY = 0.5
// Placement "points" for 1st/2nd/3rd/4th, index-aligned with
// finalPlacements()'s tuple. Only rank matters, not actual match scores.
const PLACEMENT_POINTS = [3, 2, 1, 0]
// Stands in for Round Robin's per-match `target`, which normally scales
// point-margins into the tanh/expectation formulas. Placement points have
// no natural "target" (they're ranks, not scores), so this is a fixed
// tuning constant instead.
const PLACEMENT_UNIT = 1.5

export interface SnakeLaddersMatchView {
  id: string
  round: number
  court: 'top' | 'bottom'
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
  isRanked: boolean
  playerIds: string[]
  matches: SnakeLaddersMatchView[]
  ptrDeltas: Record<string, number> | null
}

export interface SnakeLaddersEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  scoreMode: 'points' | 'games'
  target: number
  totalRounds: number
  isRanked: boolean
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
    court: m.court as 'top' | 'bottom',
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
  isRanked = true
): Promise<string> {
  const fixtures = seedRound1(playerIdsByPtrDesc)
  const event = await prisma.snakeLaddersEvent.create({
    data: {
      scoreMode,
      target,
      totalRounds,
      isRanked,
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
    isRanked: event.isRanked,
    playerIds: event.playerIds,
    matches: event.matches.map(toMatchView),
    ptrDeltas: (event.ptrDeltas as Record<string, number> | null) ?? null,
  }
}

export async function listSnakeLaddersEvents(): Promise<SnakeLaddersEventSummary[]> {
  const events = await prisma.snakeLaddersEvent.findMany({
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const matchesComplete = event.matches.filter(m => m.status === 'complete').length
    const currentRound = event.matches.reduce((max, m) => Math.max(max, m.round), 1)
    const placements = finalPlacements(event.matches, event.totalRounds)

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      scoreMode: event.scoreMode as 'points' | 'games',
      target: event.target,
      totalRounds: event.totalRounds,
      isRanked: event.isRanked,
      playerIds: event.playerIds,
      currentRound,
      matchesComplete,
      matchesTotal: event.totalRounds * 2,
      firstPlaceIds: placements ? placements[0] : null,
    }
  })
}

export async function submitSnakeLaddersScore(
  eventId: string,
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.snakeLaddersEvent.findUnique({ where: { id: eventId } })
  if (!event) return { error: 'Event not found' }

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

  await prisma.snakeLaddersMatch.update({
    where: { id: matchId },
    data: { teamAScore, teamBScore, status: 'complete' },
  })

  const roundMatches = await prisma.snakeLaddersMatch.findMany({ where: { eventId, round: match.round } })
  const roundComplete = roundMatches.length === 2 && roundMatches.every(m => m.status === 'complete')

  if (roundComplete) {
    if (match.round >= event.totalRounds) {
      await finalizeSnakeLaddersEvent(eventId)
    } else {
      const top = roundMatches.find(m => m.court === 'top')
      const bottom = roundMatches.find(m => m.court === 'bottom')
      if (top && bottom && top.teamAScore !== null && top.teamBScore !== null && bottom.teamAScore !== null && bottom.teamBScore !== null) {
        const fixtures = nextRoundFixtures(
          match.round + 1,
          { ...top, teamAScore: top.teamAScore, teamBScore: top.teamBScore },
          { ...bottom, teamAScore: bottom.teamAScore, teamBScore: bottom.teamBScore }
        )
        await prisma.snakeLaddersMatch.createMany({ data: fixtures.map(f => ({ eventId, ...f })) })
      }
    }
  }

  return { ok: true }
}

// In-progress events can be deleted freely (they've never touched PTR).
// Completed events require allowComplete — used by the admin panel — and
// reverse the PTR they applied before removing the event and its matches.
export async function deleteSnakeLaddersEvent(
  id: string,
  opts?: { allowComplete?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const event = await prisma.snakeLaddersEvent.findUnique({ where: { id } })
  if (!event) return { error: 'Event not found' }
  if (event.status === 'complete' && !opts?.allowComplete) {
    return { error: 'Completed events can only be deleted from the admin page' }
  }

  await prisma.$transaction(async tx => {
    if (event.status === 'complete') {
      const history = await tx.pTRHistory.findMany({ where: { slEventId: id } })
      for (const h of history) {
        await tx.player.update({
          where: { id: h.playerId },
          data: { ptr: { decrement: h.delta } },
        })
      }
      await tx.pTRHistory.deleteMany({ where: { slEventId: id } })
    }
    await tx.snakeLaddersEvent.delete({ where: { id } })
  })

  return { ok: true }
}

// Translates the final round's placement into PTR movement, reusing Round
// Robin's exact margin+expectation formula (finalizeRoundRobinEvent in
// round-robin-store.ts) — the 4 final-round pairs stand in for Round
// Robin's teams, and PLACEMENT_POINTS (fixed 1st/2nd/3rd/4th tier scores)
// stand in for its accumulated match points. Raw match scores from any
// round never factor in — only who ends up in which final-round slot.
async function finalizeSnakeLaddersEvent(eventId: string): Promise<void> {
  const event = await prisma.snakeLaddersEvent.findUnique({
    where: { id: eventId },
    include: { matches: true },
  })
  if (!event || event.status === 'complete') return

  const teams = finalPlacements(event.matches, event.totalRounds)
  if (!teams) return

  const players = await prisma.player.findMany({ where: { id: { in: event.playerIds } } })
  const byId = new Map(players.map(p => [p.id, p]))

  const teamCount = teams.length
  const teamPoints = PLACEMENT_POINTS
  const totalPool = teamPoints.reduce((sum, v) => sum + v, 0)

  const avgK = players.reduce(
    (sum, p) => sum + calculateKFactor(calculateReliability(p.matchesPlayed)),
    0
  ) / players.length

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
      const expectationRounds = (myPoints - expectedPoints) / PLACEMENT_UNIT

      const marginRounds = otherIdx.reduce(
        (sum, o) => sum + Math.tanh((myPoints - teamPoints[o]) / PLACEMENT_UNIT),
        0
      ) / otherIdx.length

      const sign = marginRounds >= 0 ? 1 : -1
      const multiplier = 1 + Math.max(
        -0.5,
        Math.min(0.5, sign * expectationRounds * SNAKE_LADDERS_EXPECTATION_SENSITIVITY)
      )

      const rawDelta = Math.round(marginRounds * avgK * SNAKE_LADDERS_PTR_WEIGHT * multiplier * 10) / 10
      const finalDelta = event.isRanked ? rawDelta : 0

      for (const playerId of teams[t]) {
        const player = byId.get(playerId)
        if (!player) continue
        appliedDeltas[playerId] = finalDelta

        await tx.player.update({
          where: { id: playerId },
          data: { ptr: player.ptr + finalDelta },
        })
        await tx.pTRHistory.create({
          data: {
            playerId,
            matchId: null,
            slEventId: eventId,
            ptrBefore: player.ptr,
            ptrAfter: player.ptr + finalDelta,
            delta: finalDelta,
            reliability: calculateReliability(player.matchesPlayed),
          },
        })
      }
    }

    await tx.snakeLaddersEvent.update({
      where: { id: eventId },
      data: { status: 'complete', ptrDeltas: appliedDeltas },
    })
  })
}
