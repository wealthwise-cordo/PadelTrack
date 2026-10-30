import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import {
  MATCH_INCLUDE, autoConfirmExpired, confirmerIds, finalizeIfReady, firstName, getMatchById, getPlayerForUser, involving,
  isFull, lineupIdsOf, lineupOf, resolveStartsAt, resultLine, sideOf, validateScore, whenLabel,
} from '@/lib/store'
import type { MatchWithPlayers } from '@/types'
import type { Prisma } from '@prisma/client'

// Matches set up ahead of time (status "scheduled"). See the Match model for
// the lifecycle; in short:
//   - the organiser picks a future date and time, the players and the venue;
//     the others are notified. Seats can be left open. Until a score is in,
//     the organiser can add, remove or swap players, change the details, or
//     cancel it;
//   - 25 hours before the start, everyone gets a reminder (if it was set up
//     more than 25 hours ahead — otherwise the "added" notice was enough);
//   - 2 hours after the start, everyone is asked to add the score;
//   - any player can enter the score once it has started. A friendly is
//     then done. A ranked one goes through the usual confirmation, except
//     that a matching entry from the other pair confirms it outright, and a
//     different entry makes it disputed until an opponent of one of the
//     submitters picks the right one (disputes never auto-confirm).

export const REMINDER_HOURS = 25
export const SCORE_PROMPT_HOURS = 2
const DISPUTE_REMINDER_HOURS = 24
const HOUR = 3_600_000

type Side = 'A' | 'B'
type Sets = { teamAGames: number; teamBGames: number }[]
type Result<T = object> = ({ ok: true } & T) | { error: string }
type MatchRow = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>

const playersOf = (m: MatchRow) => lineupOf(m)
const userIdsOf = (m: MatchRow, except?: string) => playersOf(m).map(p => p.userId).filter((id): id is string => !!id && id !== except)

function sameScore(a: { sets: unknown; winner: string | null; incomplete: boolean }, b: { sets: Sets; winner: string | null; incomplete: boolean }) {
  const as = a.sets as Sets
  return a.incomplete === b.incomplete && a.winner === b.winner && as.length === b.sets.length &&
    as.every((s, i) => s.teamAGames === b.sets[i].teamAGames && s.teamBGames === b.sets[i].teamBGames)
}

// --- Editing -------------------------------------------------------------------

export async function updateScheduledMatch(userId: string, matchId: string, data: {
  // Null leaves that seat open.
  teamAPlayer1Id: string | null; teamAPlayer2Id: string | null; teamBPlayer1Id: string | null; teamBPlayer2Id: string | null
  startsAt: unknown; location?: string; clubId?: string; isRanked?: boolean
}): Promise<Result> {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!m || !m.organiserId) return { error: 'Match not found' }
  if (m.organiserId !== userId) return { error: 'Only the person who set up this match can change it' }
  if (m.status !== 'scheduled') return { error: 'A score has been entered, so this match can’t be changed' }

  const startsAt = resolveStartsAt(data.startsAt)
  if (!startsAt) return { error: 'Pick a valid date and time' }
  const timeChanged = startsAt.getTime() !== m.playedAt.getTime()
  // Once it has started the line-up can still change (until a score is in),
  // but a new time has to be in the future.
  if (timeChanged && startsAt.getTime() <= Date.now()) return { error: 'Pick a date and time in the future' }
  const seats = [data.teamAPlayer1Id || null, data.teamAPlayer2Id || null, data.teamBPlayer1Id || null, data.teamBPlayer2Id || null]
  const ids = lineupIdsOf({ teamAPlayer1Id: seats[0], teamAPlayer2Id: seats[1], teamBPlayer1Id: seats[2], teamBPlayer2Id: seats[3] })
  if (new Set(ids).size !== ids.length) return { error: 'All four players must be different' }
  const me = await getPlayerForUser(userId)
  if (!me || !ids.includes(me.id)) return { error: 'You must be one of the four players' }
  const players = await prisma.player.findMany({ where: { id: { in: ids }, deletedAt: null } })
  if (players.length !== ids.length) return { error: 'One or more players were not found' }
  const club = data.clubId ? await prisma.club.findFirst({ where: { id: data.clubId, active: true } }) : null
  if (data.clubId && !club) return { error: 'That club was not found' }
  const location = club ? `${club.name}, ${club.area}` : data.location?.trim().slice(0, 60) || null
  const isRanked = data.isRanked !== false

  // Only while it's still unscored: someone may be entering a score right now.
  const updated = await prisma.match.updateMany({
    where: { id: matchId, status: 'scheduled' },
    data: {
      teamAPlayer1Id: seats[0], teamAPlayer2Id: seats[1], teamBPlayer1Id: seats[2], teamBPlayer2Id: seats[3],
      playedAt: startsAt, location, clubId: club?.id ?? null, isRanked,
      // A new time gets its own reminder and score prompt; submittedAt marks
      // when it was (re)scheduled, which decides whether a reminder is due.
      ...(timeChanged && { reminderSentAt: null, scorePromptSentAt: null, submittedAt: new Date() }),
    },
  })
  if (updated.count === 0) return { error: 'A score has been entered, so this match can’t be changed' }

  const before = new Set(playersOf(m).map(p => p.userId).filter(Boolean))
  const after = new Set(players.map(p => p.userId).filter(Boolean))
  const added = Array.from(after).filter(id => !before.has(id) && id !== userId)
  const removed = Array.from(before).filter(id => !after.has(id) && id !== userId)
  const stayed = Array.from(after).filter(id => before.has(id) && id !== userId)
  const where = location ? ` at ${location}` : ''
  const who = firstName(me.name)
  await sendPush(added, { title: 'You’ve been added to a match', body: `${who} added you to a ${isRanked ? 'ranked match' : 'friendly'}: ${whenLabel(startsAt)}${where}`, url: '/matches', tag: `match-${matchId}` })
  await sendPush(removed, { title: 'Removed from a match', body: `${who} took you off the match on ${whenLabel(m.playedAt)}.`, url: '/matches', tag: `match-${matchId}` })
  // Seats moving (a swap, or someone leaving or joining) counts as a change.
  const moved = seats.some((id, i) => id !== [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id][i])
  const changed = timeChanged || location !== m.location || isRanked !== m.isRanked || moved
  if (changed) {
    await sendPush(stayed, { title: 'Match updated', body: `${who} changed your match: now ${whenLabel(startsAt)}${where}${isRanked ? '' : ' (friendly)'}`, url: '/matches', tag: `match-${matchId}` })
  }
  return { ok: true }
}

// --- Join links ---------------------------------------------------------------------

const SEATS = ['teamAPlayer1Id', 'teamAPlayer2Id', 'teamBPlayer1Id', 'teamBPlayer2Id'] as const

// The organiser's link for others to take an open spot. Made on first share,
// then reused.
export async function getJoinToken(userId: string, matchId: string): Promise<Result<{ token: string }>> {
  const m = await prisma.match.findUnique({ where: { id: matchId } })
  if (!m || !m.organiserId) return { error: 'Match not found' }
  if (m.organiserId !== userId) return { error: 'Only the person who set up this match can share it' }
  if (m.status !== 'scheduled') return { error: 'A score has been entered, so nobody can join now' }
  if (isFull(m)) return { error: 'This match is full' }
  if (m.joinToken) return { ok: true, token: m.joinToken }
  const token = randomBytes(12).toString('base64url')
  await prisma.match.updateMany({ where: { id: matchId, joinToken: null }, data: { joinToken: token } })
  const saved = await prisma.match.findUnique({ where: { id: matchId }, select: { joinToken: true } })
  return saved?.joinToken ? { ok: true, token: saved.joinToken } : { error: 'Match not found' }
}

// The match behind a join link, while it's still open to join.
export async function getMatchByJoinToken(token: string): Promise<MatchWithPlayers | null> {
  const m = await prisma.match.findUnique({ where: { joinToken: token }, select: { id: true, status: true } })
  return m && m.status === 'scheduled' ? getMatchById(m.id) : null
}

// Someone opening a join link takes the open spot they picked (0–1 are the
// first pair, 2–3 the second). The organiser and the others are told.
export async function joinMatch(userId: string, token: string, seat: number): Promise<Result<{ matchId: string }>> {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) return { error: 'Pick a spot' }
  const me = await getPlayerForUser(userId)
  const m = await prisma.match.findUnique({ where: { joinToken: token }, include: MATCH_INCLUDE })
  if (!me || !m || m.status !== 'scheduled') return { error: 'This link is no longer valid' }
  if (sideOf(m, me.id)) return { ok: true, matchId: m.id }
  if (isFull(m)) return { error: 'This match is already full' }
  if (m[SEATS[seat]]) return { error: 'Someone just took that spot — pick another' }

  // Only if the spot is still free and you're not in it already.
  const taken = await prisma.match.updateMany({
    where: { id: m.id, status: 'scheduled', [SEATS[seat]]: null, NOT: { OR: SEATS.map(k => ({ [k]: me.id })) } },
    data: { [SEATS[seat]]: me.id },
  })
  if (taken.count === 0) return { error: 'Someone just took that spot — pick another' }

  const partnerSeat = seat ^ 1
  const partner = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2][partnerSeat]
  const who = firstName(me.name)
  await sendPush(userIdsOf(m, userId), {
    title: 'Someone joined your match',
    body: `${who} joined ${whenLabel(m.playedAt)}${m.location ? ` at ${m.location}` : ''}${partner ? `, partnering ${firstName(partner.name)}` : ''}`,
    url: '/matches',
    tag: `match-${m.id}`,
  })
  return { ok: true, matchId: m.id }
}

// --- Entering the score ----------------------------------------------------------

export async function submitScore(
  userId: string,
  matchId: string,
  input: { sets: Sets; winner: Side | null; incomplete: boolean },
  retried = false,
): Promise<Result<{ outcome: 'complete' | 'pending' | 'confirmed' | 'partner' | 'disputed' }>> {
  const me = await getPlayerForUser(userId)
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!me || !m || !m.organiserId) return { error: 'Match not found' }
  const mySide = sideOf(m, me.id)
  if (!mySide) return { error: 'Only players in this match can add its score' }
  if (m.playedAt.getTime() > Date.now()) return { error: 'You can add the score once the match has started' }
  if (m.status === 'complete' || m.scoreConfirmedAt) return { error: 'This match already has a confirmed score' }
  if (!isFull(m)) return { error: 'This match still has open spots — add all four players before the score' }

  const incomplete = input.incomplete === true
  const winner = incomplete ? null : input.winner
  const scoreError = validateScore(input.sets, winner, incomplete)
  if (scoreError) return { error: scoreError }
  const sets = input.sets.map(s => ({ teamAGames: s.teamAGames, teamBGames: s.teamBGames }))
  const mine = { sets, winner, incomplete }
  const byId = new Map(playersOf(m).map(p => [p.id, p]))
  const line = resultLine({ ...m, winner, sets }, byId)

  // First score in.
  if (m.status === 'scheduled') {
    const done = await prisma.$transaction(async tx => {
      const claimed = await tx.match.updateMany({
        where: { id: matchId, status: 'scheduled' },
        data: {
          status: m.isRanked ? 'pending' : 'complete',
          winner, incomplete, recordedById: userId, submittedAt: new Date(),
          ...(!m.isRanked && { confirmedAt: new Date() }),
        },
      })
      if (claimed.count === 0) return false
      await tx.matchSet.createMany({ data: sets.map((s, i) => ({ matchId, setNumber: i + 1, ...s })) })
      await tx.matchScoreReport.create({ data: { matchId, submittedById: userId, sets, winner, incomplete, status: m.isRanked ? 'open' : 'accepted' } })
      return true
    })
    // Someone else's score landed first: treat this as the second entry.
    if (!done) return retried ? { error: 'Someone just added a score — refresh and try again' } : submitScore(userId, matchId, input, true)

    if (!m.isRanked) {
      await sendPush(userIdsOf(m, userId), { title: 'Score added', body: `${firstName(me.name)} added the score: ${line}`, url: '/matches', tag: `match-${matchId}` })
      return { ok: true, outcome: 'complete' }
    }
    const theirs = playersOf(m).filter(p => confirmerIds(m, me.id).includes(p.id)).map(p => p.userId)
    await sendPush(theirs, { title: 'Confirm your match', body: `${firstName(me.name)} entered: ${line}`, url: '/matches', tag: `match-${matchId}` })
    return { ok: true, outcome: 'pending' }
  }

  // A score is already in and waiting.
  const open = m.scoreReports.filter(r => r.status === 'open')
  if (open.some(r => r.submittedById === userId)) return { error: 'You’ve already entered a score for this match' }
  const agreeing = open.filter(r => sameScore(r, mine))

  if (agreeing.length) {
    const report = await prisma.matchScoreReport.create({ data: { matchId, submittedById: userId, sets, winner, incomplete } })
    // An entry from someone who could confirm mine (usually the other pair).
    const fromOtherPair = agreeing.find(r => r.submittedBy.player && confirmerIds(m, r.submittedBy.player.id).includes(me.id))
    if (!fromOtherPair) return { ok: true, outcome: 'partner' }
    // Both agree: that's the confirmation.
    const accepted = await acceptReport(m, report.id, mine, fromOtherPair.submittedById)
    if ('error' in accepted) return accepted
    await sendPush(userIdsOf(m, userId), { title: 'Match confirmed', body: `Both pairs entered the same score: ${line}`, url: '/matches', tag: `match-${matchId}` })
    return { ok: true, outcome: 'confirmed' }
  }

  // Different score: disputed until an opponent of one submitter picks one.
  await prisma.$transaction([
    prisma.matchScoreReport.create({ data: { matchId, submittedById: userId, sets, winner, incomplete } }),
    prisma.match.update({ where: { id: matchId }, data: { disputed: true, disputeRemindedAt: null } }),
  ])
  await sendPush(userIdsOf(m, userId), {
    title: 'Scores don’t match',
    body: `${firstName(me.name)} entered ${line}, which differs from the score already in. Open Match Centre to pick the right one.`,
    url: '/matches',
    tag: `match-${matchId}`,
  })
  return { ok: true, outcome: 'disputed' }
}

// Makes one entry the match's score: copies it onto the match, accepts every
// entry with the same score and rejects the rest, then lets the match become
// ranked if everyone's on PadelTrack.
export async function acceptReport(m: MatchRow, reportId: string, score: { sets: Sets; winner: string | null; incomplete: boolean }, recordedById: string): Promise<Result> {
  const ok = await prisma.$transaction(async tx => {
    const claimed = await tx.match.updateMany({
      where: { id: m.id, status: 'pending', scoreConfirmedAt: null },
      data: { winner: score.winner, incomplete: score.incomplete, recordedById, scoreConfirmedAt: new Date(), disputed: false },
    })
    if (claimed.count === 0) return false
    await tx.matchSet.deleteMany({ where: { matchId: m.id } })
    await tx.matchSet.createMany({ data: score.sets.map((s, i) => ({ matchId: m.id, setNumber: i + 1, ...s })) })
    const reports = await tx.matchScoreReport.findMany({ where: { matchId: m.id, status: 'open' } })
    for (const r of reports) {
      await tx.matchScoreReport.update({ where: { id: r.id }, data: { status: r.id === reportId || sameScore(r, score) ? 'accepted' : 'rejected' } })
    }
    return true
  })
  if (!ok) return { error: 'This match’s score has already been confirmed' }
  await finalizeIfReady(m.id)
  return { ok: true }
}

// Settling a dispute: a player picks the entry that's right. They must be on
// the other pair from whoever entered it — the same rule as confirming.
export async function confirmReport(userId: string, matchId: string, reportId: string): Promise<Result> {
  const me = await getPlayerForUser(userId)
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!me || !m) return { error: 'Match not found' }
  const mySide = sideOf(m, me.id)
  if (!mySide) return { error: 'Only players in this match can confirm its score' }
  if (m.status !== 'pending' || m.scoreConfirmedAt) return { error: 'This match’s score has already been confirmed' }
  const report = m.scoreReports.find(r => r.id === reportId && r.status === 'open')
  if (!report) return { error: 'That score is no longer open' }
  if (!report.submittedBy.player || !confirmerIds(m, report.submittedBy.player.id).includes(me.id)) return { error: 'Someone from the other pair has to confirm this score' }

  const score = { sets: report.sets as Sets, winner: report.winner, incomplete: report.incomplete }
  const accepted = await acceptReport(m, report.id, score, report.submittedById)
  if ('error' in accepted) return accepted
  const byId = new Map(playersOf(m).map(p => [p.id, p]))
  await sendPush(userIdsOf(m, userId), {
    title: 'Match confirmed',
    body: `${firstName(me.name)} confirmed ${firstName(report.submittedBy.name)}’s score: ${resultLine({ ...m, ...score }, byId)}`,
    url: '/matches',
    tag: `match-${matchId}`,
  })
  return { ok: true }
}

// --- Reads -----------------------------------------------------------------------

// Your scheduled matches that have started and still need a score.
export async function getAwaitingScore(playerId: string): Promise<MatchWithPlayers[]> {
  const rows = await prisma.match.findMany({
    where: { status: 'scheduled', playedAt: { lte: new Date() }, ...involving(playerId) },
    select: { id: true },
    orderBy: { playedAt: 'desc' },
  })
  return (await Promise.all(rows.map(r => getMatchById(r.id)))).filter((m): m is MatchWithPlayers => !!m)
}

// Ones with open spots only count for the organiser, who has to fill them.
export function countAwaitingScore(playerId: string): Promise<number> {
  const full = { teamAPlayer1Id: { not: null }, teamAPlayer2Id: { not: null }, teamBPlayer1Id: { not: null }, teamBPlayer2Id: { not: null } }
  return prisma.match.count({
    where: {
      status: 'scheduled', playedAt: { lte: new Date() },
      AND: [involving(playerId), { OR: [full, { organiser: { player: { id: playerId } } }] }],
    },
  })
}

// --- Timed notifications (called every ~10 minutes by the cron endpoint) ------------

const londonDay = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })

export async function runDueNotifications(now = new Date()) {
  const sent = { reminders: 0, scorePrompts: 0, disputeReminders: 0, autoConfirmed: 0 }

  // 25 hours before: "match tomorrow".
  const upcoming = await prisma.match.findMany({
    where: { status: 'scheduled', reminderSentAt: null, playedAt: { gt: now, lte: new Date(now.getTime() + REMINDER_HOURS * HOUR) } },
    include: MATCH_INCLUDE,
  })
  for (const m of upcoming) {
    const claimed = await prisma.match.updateMany({ where: { id: m.id, reminderSentAt: null }, data: { reminderSentAt: now } })
    if (claimed.count === 0) continue
    // Set up less than 25 hours ahead: they were only just told, so skip it.
    if (m.playedAt.getTime() - m.submittedAt.getTime() < REMINDER_HOURS * HOUR) continue
    const tomorrow = londonDay(m.playedAt) === londonDay(new Date(now.getTime() + 24 * HOUR))
    const time = m.playedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    for (const p of playersOf(m)) {
      if (!p.userId) continue
      const others = playersOf(m).filter(x => x.id !== p.id).map(x => firstName(x.name)).join(', ')
      const open = 4 - playersOf(m).length
      const spots = open ? ` — ${open} spot${open > 1 ? 's' : ''} still open` : ''
      await sendPush([p.userId], {
        title: tomorrow ? 'Padel tomorrow' : 'Padel coming up',
        body: `${tomorrow ? `Tomorrow at ${time}` : whenLabel(m.playedAt)}${m.location ? ` at ${m.location}` : ''}${others ? ` with ${others}` : ''}${spots}`,
        url: '/matches',
        tag: `match-${m.id}`,
      })
    }
    sent.reminders++
  }

  // 2 hours after the start: "add the score".
  const finished = await prisma.match.findMany({
    where: { status: 'scheduled', scorePromptSentAt: null, playedAt: { lte: new Date(now.getTime() - SCORE_PROMPT_HOURS * HOUR) } },
    include: MATCH_INCLUDE,
  })
  for (const m of finished) {
    const claimed = await prisma.match.updateMany({ where: { id: m.id, scorePromptSentAt: null }, data: { scorePromptSentAt: now } })
    if (claimed.count === 0) continue
    // Seats still open: only the organiser can fill them, before the score.
    if (!isFull(m)) {
      await sendPush([m.organiserId], {
        title: 'How did it go?',
        body: `Add the missing players to your match on ${whenLabel(m.playedAt)}, then the score.`,
        url: `/matches/${m.id}/edit`,
        tag: `match-${m.id}`,
      })
      sent.scorePrompts++
      continue
    }
    await sendPush(userIdsOf(m), {
      title: 'How did it go?',
      body: `Add the score for your match on ${whenLabel(m.playedAt)}.`,
      url: `/matches/${m.id}/score`,
      tag: `match-${m.id}`,
    })
    sent.scorePrompts++
  }

  // Disputes: a nudge once a day to whoever can settle them.
  const disputed = await prisma.match.findMany({ where: { status: 'pending', disputed: true }, include: MATCH_INCLUDE })
  for (const m of disputed) {
    const open = m.scoreReports.filter(r => r.status === 'open')
    const last = m.disputeRemindedAt ?? open.reduce<Date | null>((max, r) => (!max || r.createdAt > max ? r.createdAt : max), null)
    if (!last || now.getTime() - last.getTime() < DISPUTE_REMINDER_HOURS * HOUR) continue
    const claimed = await prisma.match.updateMany({ where: { id: m.id, disputeRemindedAt: m.disputeRemindedAt }, data: { disputeRemindedAt: now } })
    if (claimed.count === 0) continue
    const submitterSides = new Set(open.map(r => (r.submittedBy.player ? sideOf(m, r.submittedBy.player.id) : null)))
    const canSettle = playersOf(m).filter(p => p.userId && Array.from(submitterSides).some(s => s && s !== sideOf(m, p.id))).map(p => p.userId)
    await sendPush(canSettle, {
      title: 'Scores still don’t match',
      body: `Your match on ${whenLabel(m.playedAt)} has two different scores. Pick the right one so it can count.`,
      url: '/matches',
      tag: `match-${m.id}`,
    })
    sent.disputeReminders++
  }

  sent.autoConfirmed = await autoConfirmExpired()
  return sent
}
