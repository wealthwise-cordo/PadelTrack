import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { sendPush, usersOfPlayers } from './push'
import { generateRoundRobinSchedule, scoreLeagueResult, leagueStandings, leagueMatchActions, checkOneOffScore, type LeagueScoring, type OneOffScoring, type SetScore } from './round-robin'
import { computeLeaderboardPoints } from './americano'
import { canManageEvent, eventsVisibleTo, type Actor } from './event-access'

export interface RoundRobinMatchView {
  id: string
  round: number
  court: number | null
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAScore: number | null
  teamBScore: number | null
  sets: SetScore[] | null
  status: 'pending' | 'submitted' | 'complete'
  // League: who entered the score (player id) and when, and whether it
  // confirmed itself after 48 hours.
  submittedById: string | null
  submittedAt: string | null
  autoConfirmed: boolean
}

export interface RoundRobinEventView {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  target: number
  courts: number
  league: boolean
  // League: games | set | match. One-off event: games | points.
  scoring: LeagueScoring | OneOffScoring
  ownerId: string
  teams: [string, string][]
  matches: RoundRobinMatchView[]
}

export interface RoundRobinEventSummary {
  id: string
  createdAt: string
  status: 'in_progress' | 'complete'
  target: number
  courts: number
  league: boolean
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
  ownerId: string,
  courts = 1,
  league = false,
  scoring: LeagueScoring | OneOffScoring = 'games'
): Promise<string> {
  const fixtures = generateRoundRobinSchedule(teams, courts, league)
  const event = await prisma.roundRobinEvent.create({
    data: {
      target,
      ownerId,
      courts: league ? 1 : courts,
      league,
      scoring,
      teamPlayerIds: teams.flat(),
      matches: { create: fixtures.map(f => ({ ...f })) },
    },
  })
  return event.id
}

export async function getRoundRobinEvent(id: string): Promise<RoundRobinEventView | null> {
  await settleLeagueScores({ eventId: id })
  const event = await prisma.roundRobinEvent.findUnique({
    where: { id },
    include: { matches: { orderBy: [{ round: 'asc' }, { court: 'asc' }] } },
  })
  if (!event) return null

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    status: event.status as 'in_progress' | 'complete',
    target: event.target,
    courts: event.courts,
    league: event.league,
    scoring: event.scoring as LeagueScoring | OneOffScoring,
    ownerId: event.ownerId,
    teams: chunkTeams(event.teamPlayerIds),
    matches: event.matches.map(m => ({
      id: m.id,
      round: m.round,
      court: m.court,
      teamAPlayer1Id: m.teamAPlayer1Id,
      teamAPlayer2Id: m.teamAPlayer2Id,
      teamBPlayer1Id: m.teamBPlayer1Id,
      teamBPlayer2Id: m.teamBPlayer2Id,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      sets: (m.sets as SetScore[] | null) ?? null,
      status: m.status as RoundRobinMatchView['status'],
      submittedById: m.submittedById,
      submittedAt: m.submittedAt?.toISOString() ?? null,
      autoConfirmed: m.autoConfirmed,
    })),
  }
}

export async function listRoundRobinEvents(actor: Actor): Promise<RoundRobinEventSummary[]> {
  await settleLeagueScores({})
  const events = await prisma.roundRobinEvent.findMany({
    where: eventsVisibleTo(actor, 'teamPlayerIds'),
    include: { matches: true },
    orderBy: { createdAt: 'desc' },
  })

  return events.map(event => {
    const teams = chunkTeams(event.teamPlayerIds)
    // Leagues rank by wins; one-off events by games won.
    const leaderboard = event.league
      ? leagueStandings(teams, event.matches.map(m => ({ ...m, sets: m.sets as SetScore[] | null }))).map(r => ({ teamIndex: r.teamIndex, playerIds: r.playerIds, points: r.won }))
      : teamLeaderboard(teams, computeLeaderboardPoints(event.matches, event.teamPlayerIds))
    const matchesComplete = event.matches.filter(m => m.status === 'complete').length

    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      status: event.status as 'in_progress' | 'complete',
      target: event.target,
      courts: event.courts,
      league: event.league,
      ownerId: event.ownerId,
      teams,
      matchesComplete,
      matchesTotal: event.matches.length,
      leaderboard,
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
  if (event.league) return { error: 'League scores are entered by the players in each match' }
  if (!canManageEvent(event, actor)) return { error: 'Only the organiser or players in this event can enter scores' }

  const invalid = checkOneOffScore(event.scoring as OneOffScoring, event.target, teamAScore, teamBScore)
  if (invalid) return { error: invalid }

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

  const remaining = await prisma.roundRobinMatch.count({ where: { eventId, status: { not: 'complete' } } })
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

// ---------------------------------------------------------------------------
// Leagues — ranked-match rules without the rating change: only the players in
// a match enter its score, the other pair confirms (or rejects) it, and an
// unanswered score confirms itself after 48 hours.
// ---------------------------------------------------------------------------

const LEAGUE_CONFIRM_MS = 48 * 60 * 60 * 1000

// Confirms scores nobody answered within 48 hours, then closes any league
// that has nothing left to play or confirm. Runs whenever leagues are read.
async function settleLeagueScores(where: { eventId?: string }) {
  const expired = await prisma.roundRobinMatch.findMany({
    where: { ...where, status: 'submitted', submittedAt: { lte: new Date(Date.now() - LEAGUE_CONFIRM_MS) }, event: { league: true } },
    select: { id: true, eventId: true },
  })
  if (!expired.length) return
  await prisma.roundRobinMatch.updateMany({
    where: { id: { in: expired.map(m => m.id) }, status: 'submitted' },
    data: { status: 'complete', confirmedAt: new Date(), autoConfirmed: true },
  })
  for (const eventId of Array.from(new Set(expired.map(m => m.eventId)))) await finalizeIfDone(eventId)
}

async function finalizeIfDone(eventId: string) {
  const open = await prisma.roundRobinMatch.count({ where: { eventId, status: { not: 'complete' } } })
  if (open === 0) await finalizeRoundRobinEvent(eventId)
}

async function loadLeagueMatch(actor: Actor, eventId: string, matchId: string) {
  const match = await prisma.roundRobinMatch.findUnique({ where: { id: matchId }, include: { event: true } })
  if (!match || match.eventId !== eventId) return { error: 'Match not found' } as const
  if (!match.event.league) return { error: 'Not a league match' } as const
  return { match, actions: leagueMatchActions(match, actor.playerId) } as const
}

export async function submitLeagueScore(actor: Actor, eventId: string, matchId: string, sets: unknown): Promise<{ ok: true } | { error: string }> {
  const found = await loadLeagueMatch(actor, eventId, matchId)
  if ('error' in found) return { error: found.error as string }
  if (!found.actions.canSubmit) return { error: 'Only players in this match can enter its score, once' }
  const result = scoreLeagueResult(found.match.event.scoring as LeagueScoring, sets)
  if ('error' in result) return result
  const saved = await prisma.roundRobinMatch.updateMany({
    where: { id: matchId, status: 'pending' },
    data: {
      status: 'submitted',
      teamAScore: result.teamAScore,
      teamBScore: result.teamBScore,
      sets: result.sets,
      submittedById: actor.playerId,
      submittedAt: new Date(),
    },
  })
  if (saved.count === 0) return { error: 'Someone already entered this score' }
  await notifyLeague(found.match, actor.playerId, 'other', 'Confirm your league score', 'entered a league score — confirm or reject it.')
  return { ok: true }
}

// Phone notifications for league scores: `other` = the pair that didn't act,
// `submitter` = whoever entered the score.
async function notifyLeague(
  m: { eventId: string; teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string; submittedById: string | null },
  actorPlayerId: string,
  to: 'other' | 'submitter',
  title: string,
  action: string
) {
  const onA = [m.teamAPlayer1Id, m.teamAPlayer2Id].includes(actorPlayerId)
  const targets = to === 'submitter'
    ? (m.submittedById ? [m.submittedById] : [])
    : onA ? [m.teamBPlayer1Id, m.teamBPlayer2Id] : [m.teamAPlayer1Id, m.teamAPlayer2Id]
  const actor = await prisma.player.findUnique({ where: { id: actorPlayerId }, select: { name: true } })
  await sendPush(await usersOfPlayers(targets), {
    title,
    body: `${(actor?.name ?? 'A player').split(' ')[0]} ${action}`,
    url: `/events/round-robin/${m.eventId}`,
  })
}

export async function confirmLeagueScore(actor: Actor, eventId: string, matchId: string): Promise<{ ok: true } | { error: string }> {
  const found = await loadLeagueMatch(actor, eventId, matchId)
  if ('error' in found) return { error: found.error as string }
  if (!found.actions.canConfirm) return { error: 'Only the other pair in this match can confirm it' }
  const saved = await prisma.roundRobinMatch.updateMany({
    where: { id: matchId, status: 'submitted' },
    data: { status: 'complete', confirmedAt: new Date() },
  })
  if (saved.count === 0) return { error: 'This score has already been confirmed or changed' }
  await finalizeIfDone(eventId)
  await notifyLeague(found.match, actor.playerId, 'submitter', 'League score confirmed', 'confirmed the score you entered.')
  return { ok: true }
}

// Rejecting (other pair) or withdrawing (pair that entered it) clears the
// score so it can be entered again.
export async function clearLeagueScore(actor: Actor, eventId: string, matchId: string): Promise<{ ok: true } | { error: string }> {
  const found = await loadLeagueMatch(actor, eventId, matchId)
  if ('error' in found) return { error: found.error as string }
  if (!found.actions.canClear) return { error: 'Only players in this match can reject or withdraw its score' }
  const saved = await prisma.roundRobinMatch.updateMany({
    where: { id: matchId, status: 'submitted' },
    data: { status: 'pending', teamAScore: null, teamBScore: null, sets: Prisma.DbNull, submittedById: null, submittedAt: null },
  })
  if (saved.count === 0) return { error: 'This score has already been confirmed or changed' }
  // Rejected by the other pair (not withdrawn by the pair that entered it).
  if (found.actions.canConfirm) {
    await notifyLeague(found.match, actor.playerId, 'submitter', 'League score rejected', 'rejected the score you entered — enter it again.')
  }
  return { ok: true }
}

