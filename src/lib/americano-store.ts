import { prisma } from './prisma'
import { generateAmericanoSchedule } from './americano'
import { calculatePTRChanges, calculateReliability } from './ptr-algorithm'

// Weight applied to Americano matches relative to a normal ranked match.
// The whole event's net effect on a player's PTR is scaled to roughly this
// fraction of what one typical ranked match would produce.
const AMERICANO_PTR_WEIGHT = 0.75

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
  playerIds: string[]
  matchesComplete: number
  matchesTotal: number
  leaderboard: { playerId: string; points: number }[]
}

export async function createAmericanoEvent(
  playerIds: string[],
  scoreMode: 'points' | 'games',
  target: number
): Promise<string> {
  const fixtures = generateAmericanoSchedule(playerIds)
  const event = await prisma.americanoEvent.create({
    data: {
      scoreMode,
      target,
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
    const points = new Map<string, number>(event.playerIds.map(id => [id, 0]))
    let matchesComplete = 0
    for (const m of event.matches) {
      if (m.status !== 'complete' || m.teamAScore === null || m.teamBScore === null) continue
      matchesComplete++
      points.set(m.teamAPlayer1Id, (points.get(m.teamAPlayer1Id) ?? 0) + m.teamAScore)
      points.set(m.teamAPlayer2Id, (points.get(m.teamAPlayer2Id) ?? 0) + m.teamAScore)
      points.set(m.teamBPlayer1Id, (points.get(m.teamBPlayer1Id) ?? 0) + m.teamBScore)
      points.set(m.teamBPlayer2Id, (points.get(m.teamBPlayer2Id) ?? 0) + m.teamBScore)
    }

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      scoreMode: event.scoreMode as 'points' | 'games',
      target: event.target,
      playerIds: event.playerIds,
      matchesComplete,
      matchesTotal: event.matches.length,
      leaderboard: event.playerIds
        .map(playerId => ({ playerId, points: points.get(playerId) ?? 0 }))
        .sort((a, b) => b.points - a.points),
    }
  })
}

// Event wins: for each completed event, whoever tops that event's points
// leaderboard gets credit (ties all count, since Americano has no
// tiebreaker). Used for the "Eventist" award and player profile stat.
export async function getEventWinCounts(): Promise<Map<string, number>> {
  const events = await listAmericanoEvents()
  const wins = new Map<string, number>()

  for (const event of events) {
    if (event.status !== 'complete' || event.leaderboard.length === 0) continue
    const topScore = event.leaderboard[0].points
    if (topScore <= 0) continue
    for (const row of event.leaderboard) {
      if (row.points === topScore) wins.set(row.playerId, (wins.get(row.playerId) ?? 0) + 1)
    }
  }

  return wins
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

// Translates a completed event into PTR movement: each match's delta is
// computed with the normal ranked-match algorithm against players' PTR
// going into the event, the deltas are averaged per player across the
// matches they played, then scaled down by AMERICANO_PTR_WEIGHT and applied
// once. Win/loss records, streaks, and matchesPlayed are left untouched —
// this is a lightweight signal, not a ranked result.
async function finalizeAmericanoEvent(eventId: string): Promise<void> {
  const event = await prisma.americanoEvent.findUnique({
    where: { id: eventId },
    include: { matches: true },
  })
  if (!event || event.status === 'complete') return

  const players = await prisma.player.findMany({ where: { id: { in: event.playerIds } } })
  const byId = new Map(players.map(p => [p.id, p]))

  const deltaSum = new Map<string, number>()
  const matchCount = new Map<string, number>()

  for (const m of event.matches) {
    if (m.teamAScore === null || m.teamBScore === null) continue
    const pA1 = byId.get(m.teamAPlayer1Id)
    const pA2 = byId.get(m.teamAPlayer2Id)
    const pB1 = byId.get(m.teamBPlayer1Id)
    const pB2 = byId.get(m.teamBPlayer2Id)
    if (!pA1 || !pA2 || !pB1 || !pB2) continue

    const winner: 'A' | 'B' = m.teamAScore > m.teamBScore ? 'A' : 'B'
    const sets = [{ setNumber: 1, teamAGames: m.teamAScore, teamBGames: m.teamBScore }]

    const result = calculatePTRChanges(
      [pA1.ptr, pA2.ptr],
      [pB1.ptr, pB2.ptr],
      [calculateReliability(pA1.matchesPlayed), calculateReliability(pA2.matchesPlayed)],
      [calculateReliability(pB1.matchesPlayed), calculateReliability(pB2.matchesPlayed)],
      sets,
      winner
    )

    const add = (id: string, d: number) => {
      deltaSum.set(id, (deltaSum.get(id) ?? 0) + d)
      matchCount.set(id, (matchCount.get(id) ?? 0) + 1)
    }
    add(m.teamAPlayer1Id, result.playerADeltas[0])
    add(m.teamAPlayer2Id, result.playerADeltas[1])
    add(m.teamBPlayer1Id, result.playerBDeltas[0])
    add(m.teamBPlayer2Id, result.playerBDeltas[1])
  }

  const appliedDeltas: Record<string, number> = {}

  await prisma.$transaction(async tx => {
    for (const [playerId, sum] of Array.from(deltaSum)) {
      const count = matchCount.get(playerId) ?? 1
      const player = byId.get(playerId)!
      const finalDelta = Math.round((sum / count) * AMERICANO_PTR_WEIGHT * 10) / 10
      appliedDeltas[playerId] = finalDelta

      await tx.player.update({
        where: { id: playerId },
        data: { ptr: player.ptr + finalDelta },
      })
      await tx.pTRHistory.create({
        data: {
          playerId,
          matchId: null,
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
