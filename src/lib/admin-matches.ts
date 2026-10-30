import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { getRole } from '@/lib/roles'
import { MIN_REASON_LENGTH, MAX_REASON_LENGTH } from '@/lib/rating-adjustments'
import { acceptReport } from '@/lib/scheduled-matches'
import { MATCH_INCLUDE, finalizeIfReady, getMatchById, getPlayerForUser, lineupOf, resultLine, whenLabel } from '@/lib/store'
import type { MatchWithPlayers } from '@/types'
import type { Prisma } from '@prisma/client'

// The super user stepping in on matches that aren't confirmed yet — never
// confirmed ones, whose ratings later matches build on. Three actions:
//   confirm — a pending score nobody has confirmed;
//   settle  — a disputed one, by picking the entered score that's right;
//   void    — remove it (pending, or set up in advance and never scored).
// Each needs a reason, tells the players, and is logged. The super user
// can't act on a match they played in; they handle those as a player.

const STALE_SCHEDULED_HOURS = 24
type Result = { ok: true } | { error: string }
type MatchRow = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>
export type AdminAction = 'confirm' | 'settle' | 'void'

const playersOf = (m: MatchRow) => lineupOf(m)

function summaryOf(m: MatchRow, sets: { teamAGames: number; teamBGames: number }[] = m.sets): string {
  const first = (p: { name: string } | null) => p ? p.name.split(' ')[0] : 'Open'
  const pair = (a: { name: string } | null, b: { name: string } | null) => `${first(a)} & ${first(b)}`
  const score = sets.length ? ` · ${sets.map(s => `${s.teamAGames}–${s.teamBGames}`).join(' ')}` : ''
  return `${pair(m.teamAPlayer1, m.teamAPlayer2)} v ${pair(m.teamBPlayer1, m.teamBPlayer2)}${score} · ${whenLabel(m.playedAt)}`
}

const notIn = (playerId: string): Prisma.MatchWhereInput => ({
  NOT: { OR: [{ teamAPlayer1Id: playerId }, { teamAPlayer2Id: playerId }, { teamBPlayer1Id: playerId }, { teamBPlayer2Id: playerId }] },
})

// Matches needing a hand: disputes first, then unconfirmed scores (oldest
// first), then matches set up in advance that started over a day ago and
// still have no score. Leaves out the super user's own matches.
export async function getAdminMatchQueue(superPlayerId: string): Promise<MatchWithPlayers[]> {
  const rows = await prisma.match.findMany({
    where: {
      ...notIn(superPlayerId),
      OR: [
        { status: 'pending', scoreConfirmedAt: null },
        { status: 'scheduled', playedAt: { lte: new Date(Date.now() - STALE_SCHEDULED_HOURS * 3_600_000) } },
      ],
    },
    select: { id: true, disputed: true, status: true, submittedAt: true },
  })
  const rank = (r: (typeof rows)[number]) => (r.disputed ? 0 : r.status === 'pending' ? 1 : 2)
  rows.sort((a, b) => rank(a) - rank(b) || a.submittedAt.getTime() - b.submittedAt.getTime())
  return (await Promise.all(rows.map(r => getMatchById(r.id)))).filter((m): m is MatchWithPlayers => !!m)
}

export async function getAdminMatchLog(take = 30) {
  return prisma.adminMatchAction.findMany({ orderBy: { createdAt: 'desc' }, take, include: { by: { select: { name: true } } } })
}

// Disputes the super user can settle (not their own).
export async function countDisputes(superPlayerId: string): Promise<number> {
  return prisma.match.count({ where: { status: 'pending', disputed: true, ...notIn(superPlayerId) } })
}

export async function adminMatchAction(
  userId: string,
  matchId: string,
  input: { action: unknown; reason: unknown; reportId?: unknown },
): Promise<Result> {
  if ((await getRole(userId)) !== 'superuser') return { error: 'Only the super user can do this' }
  const action = input.action
  if (action !== 'confirm' && action !== 'settle' && action !== 'void') return { error: 'Unknown action' }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < MIN_REASON_LENGTH) return { error: `Give a reason of at least ${MIN_REASON_LENGTH} characters` }
  if (reason.length > MAX_REASON_LENGTH) return { error: `Keep the reason to ${MAX_REASON_LENGTH} characters` }

  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!m) return { error: 'Match not found' }
  const me = await getPlayerForUser(userId)
  if (me && playersOf(m).some(p => p.id === me.id)) return { error: 'You played in this match — handle it as a player instead' }
  if (m.status === 'complete' || m.scoreConfirmedAt) return { error: 'This match is already confirmed' }
  let summary = summaryOf(m)
  const byId = new Map(playersOf(m).map(p => [p.id, p]))

  let line = ''
  if (action === 'confirm') {
    if (m.status !== 'pending') return { error: 'There’s no score to confirm yet' }
    if (m.disputed) return { error: 'Two scores were entered — settle it by picking one' }
    const marked = await prisma.match.updateMany({ where: { id: matchId, status: 'pending', scoreConfirmedAt: null, disputed: false }, data: { scoreConfirmedAt: new Date() } })
    if (marked.count === 0) return { error: 'This match changed — refresh and try again' }
    await prisma.matchScoreReport.updateMany({ where: { matchId, status: 'open' }, data: { status: 'accepted' } })
    await finalizeIfReady(matchId)
    line = resultLine(m, byId)
  } else if (action === 'settle') {
    if (!m.disputed) return { error: 'This match isn’t disputed' }
    const report = m.scoreReports.find(r => r.id === input.reportId && r.status === 'open')
    if (!report) return { error: 'Pick one of the scores entered' }
    const score = { sets: report.sets as { teamAGames: number; teamBGames: number }[], winner: report.winner, incomplete: report.incomplete }
    const accepted = await acceptReport(m, report.id, score, report.submittedById)
    if ('error' in accepted) return accepted
    line = resultLine({ ...m, ...score }, byId)
    summary = summaryOf(m, score.sets)
  } else {
    if (m.status !== 'pending' && m.status !== 'scheduled') return { error: 'This match can’t be voided' }
    const gone = await prisma.match.deleteMany({ where: { id: matchId, status: { in: ['pending', 'scheduled'] }, scoreConfirmedAt: null } })
    if (gone.count === 0) return { error: 'This match changed — refresh and try again' }
  }

  await prisma.adminMatchAction.create({ data: { matchId, action, reason, summary, byId: userId } })
  const verb = { confirm: 'confirmed', settle: 'settled the score of', void: 'removed' }[action]
  await sendPush(playersOf(m).map(p => p.userId), {
    title: action === 'void' ? 'Match removed' : 'Match confirmed',
    body: `PadelTrack admin ${verb} your match on ${whenLabel(m.playedAt)}${line ? `: ${line}` : ''}. Reason: ${reason}`,
    url: '/matches',
    tag: `match-${matchId}`,
  })
  return { ok: true }
}
