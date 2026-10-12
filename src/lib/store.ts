import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import { LEGAL_VERSION } from '@/lib/legal'
import { prisma } from './prisma'
import { calculatePTRChanges, currentReliability, reliabilityAfterMatch } from './ptr-algorithm'
import { internalFromLevel, isLtaLevel, levelFromInternal } from './lta'
import { isCountryCode } from './countries'
import type { PlayerWithStats, MatchWithPlayers, PTRHistoryPoint } from '@/types'
import type { Player, PTRHistory, Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

type PlayerWithHistory = Player & { ptrHistory?: PTRHistory[] }
type MatchFull = Prisma.MatchGetPayload<{
  include: {
    teamAPlayer1: true; teamAPlayer2: true
    teamBPlayer1: true; teamBPlayer2: true
    sets: { orderBy: { setNumber: 'asc' } }
  }
}>

// Pending matches confirm themselves if no opponent acts within this window.
export const AUTO_CONFIRM_HOURS = 48
const AUTO_CONFIRM_MS = AUTO_CONFIRM_HOURS * 60 * 60 * 1000

export const AVATAR_COLORS = ['#f97316', '#3f3f46', '#0ea5e9', '#8b5cf6', '#10b981', '#e11d48', '#f59e0b', '#64748b']

function toPlayerWithStats(p: PlayerWithHistory, rank = 0): PlayerWithStats {
  const history = [...(p.ptrHistory ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatarColor: p.avatarColor,
    isGuest: !p.userId,
    ptr: p.ptr,
    reliability: p.reliability,
    matchesPlayed: p.matchesPlayed,
    wins: p.wins,
    losses: p.losses,
    setsWon: p.setsWon,
    setsLost: p.setsLost,
    gamesWon: p.gamesWon,
    gamesLost: p.gamesLost,
    tiebreaksWon: p.tiebreaksWon,
    tiebreaksPlayed: p.tiebreaksPlayed,
    currentStreak: p.currentStreak,
    bestStreak: p.bestStreak,
    ptrHistory: history.map(h => ({
      id: h.id,
      ptrBefore: h.ptrBefore,
      ptrAfter: h.ptrAfter,
      delta: h.delta,
      reliability: h.reliability,
      createdAt: h.createdAt.toISOString(),
      matchId: h.matchId,
    } satisfies PTRHistoryPoint)),
    rank,
    ptrDelta: history.length > 0 ? history[history.length - 1].delta : 0,
  }
}

function hydrateMatch(m: MatchFull, viewerDelta?: number): MatchWithPlayers {
  return {
    id: m.id,
    playedAt: m.playedAt.toISOString(),
    status: m.status as 'pending' | 'complete',
    isRanked: m.isRanked,
    winner: m.winner as 'A' | 'B',
    recordedById: m.recordedById,
    submittedAt: m.submittedAt.toISOString(),
    location: m.location,
    autoConfirmAt: new Date(m.submittedAt.getTime() + AUTO_CONFIRM_MS).toISOString(),
    autoConfirmed: m.autoConfirmed,
    scoreConfirmed: !!m.scoreConfirmedAt,
    becameFriendly: m.becameFriendly,
    guests: [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]
      .filter(p => !p.userId)
      .map(p => ({ id: p.id, name: p.name })),
    viewerDelta,
    teamAPlayer1Id: m.teamAPlayer1Id,
    teamAPlayer2Id: m.teamAPlayer2Id,
    teamBPlayer1Id: m.teamBPlayer1Id,
    teamBPlayer2Id: m.teamBPlayer2Id,
    teamAPlayer1: toPlayerWithStats(m.teamAPlayer1),
    teamAPlayer2: toPlayerWithStats(m.teamAPlayer2),
    teamBPlayer1: toPlayerWithStats(m.teamBPlayer1),
    teamBPlayer2: toPlayerWithStats(m.teamBPlayer2),
    teamAPTRBefore: m.teamAPTRBefore,
    teamBPTRBefore: m.teamBPTRBefore,
    teamAPTRAfter: m.teamAPTRAfter,
    teamBPTRAfter: m.teamBPTRAfter,
    ptrDelta: m.ptrDelta,
    scoreMultiplier: m.scoreMultiplier,
    isUpset: m.isUpset,
    matchQuality: m.matchQuality,
    sets: m.sets.map(s => ({
      setNumber: s.setNumber,
      teamAGames: s.teamAGames,
      teamBGames: s.teamBGames,
    })),
  }
}

const MATCH_INCLUDE = {
  teamAPlayer1: true, teamAPlayer2: true,
  teamBPlayer1: true, teamBPlayer2: true,
  sets: { orderBy: { setNumber: 'asc' as const } },
} satisfies Prisma.MatchInclude

function involving(playerId: string): Prisma.MatchWhereInput {
  return {
    OR: [
      { teamAPlayer1Id: playerId }, { teamAPlayer2Id: playerId },
      { teamBPlayer1Id: playerId }, { teamBPlayer2Id: playerId },
    ],
  }
}

function newClaimToken(): string {
  return randomBytes(16).toString('base64url')
}

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
}

export async function getPlayerForUser(userId: string): Promise<Player | null> {
  return prisma.player.findUnique({ where: { userId } })
}

// Creates an account and its player profile, rated from the LTA level the
// person picked. With a claimToken, the new account takes over that guest
// profile: the guest's rating starts from the lower of their own pick and the
// level whoever added them suggested, then any of their pending matches that
// are ready become ranked on top of it.
export async function signUp(data: {
  name: string
  email: string
  password: string
  level: number
  claimToken?: string
  // Required on direct sign-up; not asked when claiming a guest invite.
  gender?: string
  dateOfBirth?: string // YYYY-MM-DD
  country?: string // ISO 3166-1 alpha-2
  // Ticked "I agree" to the terms of use (incl. liability) and privacy notice.
  acceptTerms?: boolean
}): Promise<{ userId: string } | { error: string }> {
  const name = data.name.trim()
  const email = data.email.trim().toLowerCase()
  if (!name) return { error: 'Name is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email' }
  if (data.password.length < 8) return { error: 'Password must be at least 8 characters' }
  if (data.password.length > 72) return { error: 'Password must be 72 characters or fewer' }
  if (!isLtaLevel(data.level)) return { error: 'Pick the level that best describes you' }
  if (data.acceptTerms !== true) return { error: 'Please agree to the Terms and Privacy Notice to create an account' }
  const profile = validateProfileDetails(data, !data.claimToken)
  if ('error' in profile) return profile
  if (await findUserByEmail(email)) return { error: 'An account with that email already exists' }

  const guest = data.claimToken
    ? await prisma.player.findUnique({ where: { claimToken: data.claimToken } })
    : null
  if (data.claimToken && (!guest || guest.userId)) return { error: 'This invite link is no longer valid' }

  const password = await bcrypt.hash(data.password, 10)
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: { email, password, name, ...profile, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION } })
    if (guest) {
      // Guests have no rating until they join. (Older guests who already
      // have ranked matches keep the rating they earned.)
      const start = startingLevelFor(data.level, guest.suggestedLevel)
      await tx.player.update({
        where: { id: guest.id },
        data: {
          userId: user.id,
          name,
          claimToken: null,
          startingLevel: start,
          ...(guest.matchesPlayed === 0 && { ptr: internalFromLevel(start) }),
        },
      })
    } else {
      const count = await tx.player.count()
      await tx.player.create({
        data: {
          name,
          userId: user.id,
          avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
          startingLevel: data.level,
          ptr: internalFromLevel(data.level),
        },
      })
    }
    return { userId: user.id }
  })
  // A claimed guest's pending matches may now be able to become ranked.
  if (guest) await settleMatchesFor(guest.id)
  return result
}

const GENDERS = ['male', 'female', 'other']

// Gender, date of birth and country. Required when `required`; otherwise
// accepted if given.
function validateProfileDetails(
  data: { gender?: string; dateOfBirth?: string; country?: string },
  required: boolean,
): { gender?: string; dateOfBirth?: Date; country?: string } | { error: string } {
  const out: { gender?: string; dateOfBirth?: Date; country?: string } = {}
  if (data.gender || required) {
    if (!data.gender || !GENDERS.includes(data.gender)) return { error: 'Choose your gender' }
    out.gender = data.gender
  }
  if (data.dateOfBirth || required) {
    const ok = !!data.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)
    const dob = ok ? new Date(`${data.dateOfBirth}T00:00:00Z`) : null
    const age = dob ? (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000) : NaN
    if (!dob || Number.isNaN(age) || age < 5 || age > 110) return { error: 'Enter a valid date of birth' }
    out.dateOfBirth = dob
  }
  if (data.country || required) {
    if (!isCountryCode(data.country)) return { error: 'Choose your country' }
    out.country = data.country
  }
  return out
}

// When a guest joins, they start at the lower of their own pick and the
// level suggested by whoever added them.
function startingLevelFor(ownPick: number, suggested: number | null): number {
  return suggested !== null ? Math.min(ownPick, suggested) : ownPick
}

// An already-signed-in user claiming a guest profile. Only allowed while
// their own profile has no matches — merging two histories isn't supported.
export async function claimGuestForUser(token: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const guest = await prisma.player.findUnique({ where: { claimToken: token } })
  if (!guest || guest.userId) return { error: 'This invite link is no longer valid' }
  const own = await prisma.player.findUnique({ where: { userId } })
  if (own) {
    const played = await prisma.match.count({ where: involving(own.id) })
    if (played > 0) return { error: 'Your profile already has matches, so it can’t take over another profile' }
  }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  await prisma.$transaction(async tx => {
    if (own) await tx.player.delete({ where: { id: own.id } })
    await tx.player.update({
      where: { id: guest.id },
      data: {
        userId,
        claimToken: null,
        name: user?.name ?? guest.name,
        // They already picked a level for their own profile; it carries over,
        // capped by the level whoever added them suggested.
        ...(own && guest.matchesPlayed === 0 && (() => {
          const start = startingLevelFor(own.startingLevel ?? levelFromInternal(own.ptr), guest.suggestedLevel)
          return { ptr: internalFromLevel(start), startingLevel: start }
        })()),
      },
    })
  })
  await settleMatchesFor(guest.id)
  return { ok: true }
}

export async function getGuestByClaimToken(token: string) {
  return prisma.player.findFirst({
    where: { claimToken: token, userId: null },
    include: { createdBy: { select: { name: true } } },
  })
}

// ---------------------------------------------------------------------------
// Players & circles
// ---------------------------------------------------------------------------

export async function getPlayer(id: string): Promise<PlayerWithStats | null> {
  const p = await prisma.player.findUnique({ where: { id }, include: { ptrHistory: true } })
  return p ? toPlayerWithStats(p) : null
}

export async function getPlayerRaw(id: string): Promise<Player | null> {
  return prisma.player.findUnique({ where: { id } })
}

// Everyone on PadelTrack this player has shared a ranked match with — as
// partner or opponent. Guests can't be in a ranked match under the current
// rules; filtering them out also guards against older data.
export async function getCircleIds(playerId: string): Promise<string[]> {
  const matches = await prisma.match.findMany({
    where: { status: 'complete', isRanked: true, ...involving(playerId) },
    select: { teamAPlayer1Id: true, teamAPlayer2Id: true, teamBPlayer1Id: true, teamBPlayer2Id: true },
  })
  const ids = new Set<string>()
  for (const m of matches) {
    for (const id of [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]) ids.add(id)
  }
  ids.delete(playerId)
  const registered = await prisma.player.findMany({
    where: { id: { in: Array.from(ids) }, userId: { not: null } },
    select: { id: true },
  })
  return registered.map(p => p.id)
}

// The rankings view: you plus your circle, ordered by rating.
export async function getCircleRankings(playerId: string): Promise<PlayerWithStats[]> {
  const ids = [playerId, ...(await getCircleIds(playerId))]
  const rows = await prisma.player.findMany({
    where: { id: { in: ids } },
    include: { ptrHistory: true },
    orderBy: { ptr: 'desc' },
  })
  return rows.map((p, i) => toPlayerWithStats(p, i + 1))
}

// Players a user can quickly pick when recording a match or setting up an
// event: themselves, their circle, guests they've added, and guests they've
// played with.
export async function getPickablePlayers(userId: string): Promise<PlayerWithStats[]> {
  const me = await getPlayerForUser(userId)
  const circleIds = me ? await getCircleIds(me.id) : []
  // Guests you've played with in any match (they never join circles), so
  // typing their name can reuse their profile.
  const myMatches = me
    ? await prisma.match.findMany({
        where: involving(me.id),
        select: { teamAPlayer1Id: true, teamAPlayer2Id: true, teamBPlayer1Id: true, teamBPlayer2Id: true },
      })
    : []
  const playedWithIds = Array.from(new Set(myMatches.flatMap(m => [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id])))
  const rows = await prisma.player.findMany({
    where: {
      OR: [
        { userId },
        { id: { in: circleIds } },
        { createdById: userId, userId: null },
        { id: { in: playedWithIds }, userId: null },
      ],
    },
    orderBy: { name: 'asc' },
  })
  const players = rows.map(p => toPlayerWithStats(p))
  // Keep "you" first.
  return [...players.filter(p => p.id === me?.id), ...players.filter(p => p.id !== me?.id)]
}

// Finds registered players by name or exact email. Guests are never
// returned — they're added by typing their name (see createGuest).
export async function searchPlayers(query: string): Promise<PlayerWithStats[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const rows = await prisma.player.findMany({
    where: {
      OR: [
        { userId: { not: null }, name: { contains: q, mode: 'insensitive' } },
        { user: { email: q.toLowerCase() } },
      ],
    },
    orderBy: { name: 'asc' },
    take: 10,
  })
  return rows.map(p => toPlayerWithStats(p))
}

export async function createGuest(userId: string, name: string, suggestedLevel?: number): Promise<PlayerWithStats | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  if (trimmed.length > 40) return { error: 'Name is too long' }
  // Typing the same guest's name again reuses their profile, so their record
  // and invite link stay in one place instead of splitting across duplicates.
  const existing = await prisma.player.findFirst({
    where: { createdById: userId, userId: null, name: { equals: trimmed, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return toPlayerWithStats(existing)
  const count = await prisma.player.count()
  const p = await prisma.player.create({
    data: {
      name: trimmed,
      createdById: userId,
      claimToken: newClaimToken(),
      suggestedLevel: isLtaLevel(suggestedLevel) ? suggestedLevel : null,
      avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
    },
  })
  return toPlayerWithStats(p)
}

// Identity edits only (nickname/colour) — on your own profile or a guest
// you created. The display name (Player.name) is yours alone to change; your
// account keeps the name you signed up with (User.name).
export async function updatePlayer(
  id: string,
  userId: string,
  data: { name?: string; nickname?: string; avatarColor?: string }
): Promise<{ ok: true } | { error: string }> {
  const p = await prisma.player.findUnique({ where: { id } })
  if (!p) return { error: 'Player not found' }
  if (!canEditPlayer(p, userId)) return { error: 'You can only edit your own profile or guests you added' }
  if (data.name !== undefined) {
    if (p.userId !== userId) return { error: 'You can only change your own display name' }
    data = { ...data, name: data.name.trim() }
    if (!data.name) return { error: 'Display name can’t be empty' }
  }
  await prisma.player.update({ where: { id }, data })
  return { ok: true }
}

const RESET_TTL_MS = 60 * 60 * 1000
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Emails a one-hour reset link if the address has an account. Callers always
// tell the visitor the same thing, so this can't reveal who has an account.
// At most 3 links per account per hour.
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await findUserByEmail(email)
  if (!user) return
  const recent = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_TTL_MS) } } })
  if (recent >= 3) return
  const token = randomBytes(32).toString('base64url')
  await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } })
  const link = `${baseUrl}/reset-password/${token}`
  const first = user.name.split(' ')[0]
  await sendEmail({
    to: user.email,
    subject: 'Reset your PadelTrack password',
    text: `Hi ${first},\n\nUse this link to set a new PadelTrack password. It works once and expires in 1 hour:\n\n${link}\n\nIf you didn’t ask for this, you can ignore this email — your password won’t change.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b">
  <p style="font-size:20px;font-weight:800;margin:0 0 20px">Padel<span style="color:#f97316">Track</span></p>
  <p>Hi ${escapeHtml(first)},</p>
  <p>Tap the button to set a new password. The link works once and expires in 1 hour.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">Reset password</a></p>
  <p style="font-size:13px;color:#71717a">If you didn’t ask for this, you can ignore this email — your password won’t change.</p>
</div>`,
  })
}

// Whether a reset link can still be used, so the page can say so up front.
export async function isResetTokenValid(token: string): Promise<boolean> {
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } })
  return !!r && !r.usedAt && r.expiresAt > new Date()
}

// Sets the new password and uses up every outstanding link for the account.
// Returns the email so the page can sign the person straight in.
export async function resetPassword(token: string, next: string): Promise<{ email: string } | { error: string }> {
  if (next.length < 8) return { error: 'Password must be at least 8 characters' }
  if (next.length > 72) return { error: 'Password must be 72 characters or fewer' }
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
  if (!r || r.usedAt || r.expiresAt <= new Date()) return { error: 'This reset link has expired or already been used' }
  const password = await bcrypt.hash(next, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: r.userId }, data: { password } }),
    prisma.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ])
  return { email: r.user.email }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export async function changePassword(userId: string, current: string, next: string): Promise<{ ok: true } | { error: string }> {
  if (next.length < 8) return { error: 'New password must be at least 8 characters' }
  if (next.length > 72) return { error: 'New password must be 72 characters or fewer' }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'Account not found' }
  if (!(await bcrypt.compare(current, user.password))) return { error: 'Current password is incorrect' }
  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(next, 10) } })
  return { ok: true }
}

export function canEditPlayer(p: Player, userId: string): boolean {
  return p.userId === userId || (!p.userId && p.createdById === userId)
}

export async function getEventPlayers(ids: string[]): Promise<PlayerWithStats[]> {
  const rows = await prisma.player.findMany({ where: { id: { in: ids } } })
  const byId = new Map(rows.map(p => [p.id, toPlayerWithStats(p)]))
  return ids.map(id => byId.get(id)).filter((p): p is PlayerWithStats => !!p)
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

// withInvites adds guests' claim tokens to pending matches so the viewer can
// send invite links — only pass it when playerId is the signed-in viewer.
export async function getMatchesForPlayer(playerId: string, opts?: { withInvites?: boolean }): Promise<MatchWithPlayers[]> {
  const matches = await prisma.match.findMany({
    where: involving(playerId),
    include: {
      ...MATCH_INCLUDE,
      ptrHistory: { where: { playerId }, select: { delta: true } },
      recordedBy: { select: { player: { select: { id: true } } } },
    },
    orderBy: { playedAt: 'desc' },
  })
  return matches.map(m => {
    const hydrated = hydrateMatch(m, m.ptrHistory[0]?.delta)
    if (m.status === 'pending') {
      hydrated.awaitingConfirmationFrom = confirmerNames(m, m.recordedBy.player?.id)
      if (opts?.withInvites) {
        const tokens = new Map([m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].map(p => [p.id, p.claimToken]))
        hydrated.guests = hydrated.guests.map(g => ({ ...g, claimToken: tokens.get(g.id) ?? undefined }))
      }
    }
    return hydrated
  })
}

// Registered players on the team that didn't record the match.
function confirmerNames(m: MatchFull, recorderPlayerId: string | undefined): string[] {
  const recorderSide = recorderPlayerId ? sideOf(m, recorderPlayerId) : null
  const other = recorderSide === 'A' ? [m.teamBPlayer1, m.teamBPlayer2] : recorderSide === 'B' ? [m.teamAPlayer1, m.teamAPlayer2] : []
  return other.filter(p => p.userId).map(p => p.name.split(' ')[0])
}

export async function getMatchById(id: string): Promise<MatchWithPlayers | null> {
  const m = await prisma.match.findUnique({ where: { id }, include: MATCH_INCLUDE })
  return m ? hydrateMatch(m) : null
}

type Side = 'A' | 'B'

function sideOf(m: { teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }, playerId: string): Side | null {
  if (m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId) return 'A'
  if (m.teamBPlayer1Id === playerId || m.teamBPlayer2Id === playerId) return 'B'
  return null
}

// What a given user may do with a match: confirm it (registered player on
// the team opposite the recorder, while pending) and/or delete it (any
// registered player in the match; for pending ones that doubles as reject).
export async function matchPermissions(matchId: string, userId: string) {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  const me = await getPlayerForUser(userId)
  if (!m || !me) return { canConfirm: false, canDelete: false }
  const mySide = sideOf(m, me.id)
  if (!mySide) return { canConfirm: false, canDelete: false }
  const recorder = await getPlayerForUser(m.recordedById)
  const recorderSide = recorder ? sideOf(m, recorder.id) : null
  return {
    canConfirm: m.status === 'pending' && !m.scoreConfirmedAt && recorderSide !== null && mySide !== recorderSide,
    canDelete: m.status === 'pending',
  }
}

// Matches waiting for this user to confirm the score.
export async function getPendingForUser(userId: string): Promise<MatchWithPlayers[]> {
  const me = await getPlayerForUser(userId)
  if (!me) return []
  const pending = await prisma.match.findMany({
    where: { status: 'pending', scoreConfirmedAt: null, ...involving(me.id) },
    include: { ...MATCH_INCLUDE, recordedBy: { include: { player: true } } },
    orderBy: { playedAt: 'desc' },
  })
  return pending
    .filter(m => {
      const recorderPlayer = m.recordedBy.player
      if (!recorderPlayer) return false
      const recorderSide = sideOf(m, recorderPlayer.id)
      return recorderSide !== null && sideOf(m, me.id) !== recorderSide
    })
    .map(m => hydrateMatch(m))
}

// Turns the form's calendar date into a timestamp. Today keeps the current
// time (so same-day matches stay in the order they were entered); past days
// are pinned to midday UTC so they land on the right day in any UK/EU
// timezone. Allows up to 14h ahead to cover timezone differences.
function resolvePlayedAt(playedOn: string | undefined): Date | null {
  const now = new Date()
  if (!playedOn) return now
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) return null
  const d = new Date(`${playedOn}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return null
  if (d.getTime() > now.getTime() + 14 * 3_600_000) return null
  return playedOn === now.toISOString().slice(0, 10) || d > now ? now : d
}

function validateSets(sets: { teamAGames: number; teamBGames: number }[]): string | null {
  if (!Array.isArray(sets) || sets.length === 0 || sets.length > 5) return 'Enter between 1 and 5 sets'
  for (const s of sets) {
    if (!Number.isInteger(s.teamAGames) || !Number.isInteger(s.teamBGames) || s.teamAGames < 0 || s.teamBGames < 0 || s.teamAGames > 7 || s.teamBGames > 7) {
      return 'Invalid set score'
    }
  }
  return null
}

export async function createMatch(userId: string, data: {
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  sets: { teamAGames: number; teamBGames: number }[]
  winner: Side
  // 'YYYY-MM-DD'. Defaults to now; past dates allowed, future dates aren't.
  playedOn?: string
  location?: string
  // A listed club; its label becomes the location.
  clubId?: string
  // Friendly matches skip confirmation and never change ratings.
  isRanked?: boolean
}): Promise<{ matchId: string; status: 'pending' | 'complete'; ptrDelta: number; isUpset: boolean; invites: { name: string; claimToken: string }[] } | { error: string }> {
  const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner } = data
  const playedAt = resolvePlayedAt(data.playedOn)
  if (!playedAt) return { error: 'Pick a valid date that isn’t in the future' }
  const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
  if (new Set(ids).size !== 4) return { error: 'All four players must be different' }
  if (winner !== 'A' && winner !== 'B') return { error: 'Pick a winner' }
  const setError = validateSets(sets)
  if (setError) return { error: setError }

  const me = await getPlayerForUser(userId)
  if (!me) return { error: 'Your profile was not found' }
  const mySide = sideOf(data, me.id)
  if (!mySide) return { error: 'You must be one of the four players' }

  const players = await prisma.player.findMany({ where: { id: { in: ids } } })
  if (players.length !== 4) return { error: 'One or more players were not found' }

  const club = data.clubId ? await prisma.club.findFirst({ where: { id: data.clubId, active: true } }) : null
  if (data.clubId && !club) return { error: 'That club was not found' }

  // Ranked matches always start pending: an opponent confirms the score, and
  // any guests have 48 hours to join PadelTrack (see finalizeIfReady and
  // autoConfirmExpired). Friendlies are saved straight away.
  const isRanked = data.isRanked !== false
  const invites = isRanked
    ? players.filter(p => !p.userId && p.claimToken).map(p => ({ name: p.name, claimToken: p.claimToken! }))
    : []

  return prisma.$transaction(async tx => {
    const match = await tx.match.create({
      data: {
        status: 'pending',
        winner,
        playedAt,
        isRanked,
        location: club ? clubLabel(club) : data.location?.trim().slice(0, 60) || null,
        clubId: club?.id ?? null,
        recordedById: userId,
        teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
        sets: { create: sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })) },
      },
    })
    if (!isRanked) {
      await tx.match.update({ where: { id: match.id }, data: { status: 'complete', confirmedAt: new Date() } })
      return { matchId: match.id, status: 'complete' as const, ptrDelta: 0, isUpset: false, invites }
    }
    return { matchId: match.id, status: 'pending' as const, ptrDelta: 0, isUpset: false, invites }
  })
}

// An opponent confirms the score. It becomes ranked right away if nobody in
// it is still a guest; otherwise it waits for the guest(s) to join.
export async function confirmMatch(matchId: string, userId: string): Promise<{ ok: true; ranked: boolean; ptrDelta: number } | { error: string }> {
  const perms = await matchPermissions(matchId, userId)
  if (!perms.canConfirm) return { error: 'You can’t confirm this match' }
  const marked = await prisma.match.updateMany({
    where: { id: matchId, status: 'pending', scoreConfirmedAt: null },
    data: { scoreConfirmedAt: new Date() },
  })
  if (marked.count === 0) return { error: 'This score has already been confirmed' }
  const result = await finalizeIfReady(matchId)
  return { ok: true, ranked: !!result, ptrDelta: result?.ptrDelta ?? 0 }
}

// Makes a pending match ranked once its score is confirmed and everyone in it
// is on PadelTrack. Safe to call any time; returns null if it isn't ready.
async function finalizeIfReady(matchId: string): Promise<{ ptrDelta: number } | null> {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!m || m.status !== 'pending' || !m.scoreConfirmedAt) return null
  const everyoneJoined = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].every(p => p.userId)
  return everyoneJoined ? claimAndApply(matchId, false) : null
}

// After a guest joins PadelTrack, any of their pending matches whose score is
// already confirmed can now become ranked.
async function settleMatchesFor(playerId: string): Promise<void> {
  const pending = await prisma.match.findMany({ where: { status: 'pending', ...involving(playerId) }, select: { id: true } })
  for (const { id } of pending) await finalizeIfReady(id)
}

// Settles every pending match whose 48-hour window has run out, oldest first
// so ratings apply in the order matches were submitted:
// - a guest still hasn't joined → it becomes a friendly, permanently;
// - everyone's on PadelTrack → it confirms itself as ranked.
// There's no background job: this runs at the start of each signed-in request
// (see getSession), which keeps it working on any host with no extra setup.
export async function autoConfirmExpired(): Promise<number> {
  const expired = await prisma.match.findMany({
    where: { status: 'pending', submittedAt: { lte: new Date(Date.now() - AUTO_CONFIRM_MS) } },
    orderBy: { submittedAt: 'asc' },
    include: { teamAPlayer1: true, teamAPlayer2: true, teamBPlayer1: true, teamBPlayer2: true },
  })
  let settled = 0
  for (const m of expired) {
    const guestLeft = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].some(p => !p.userId)
    if (guestLeft) {
      const converted = await prisma.match.updateMany({
        where: { id: m.id, status: 'pending' },
        data: { status: 'complete', isRanked: false, becameFriendly: true, confirmedAt: new Date() },
      })
      settled += converted.count
    } else if (await claimAndApply(m.id, true)) {
      settled++
    }
  }
  return settled
}

// Atomically flips a match from pending to complete and applies ratings in
// the same transaction. The conditional update means that if two people
// confirm at once, or a confirm races the auto-confirm, only one applies;
// the others get null.
async function claimAndApply(matchId: string, auto: boolean): Promise<{ ptrDelta: number } | null> {
  return prisma.$transaction(async tx => {
    const claimed = await tx.match.updateMany({
      where: { id: matchId, status: 'pending' },
      data: { status: 'complete', autoConfirmed: auto },
    })
    if (claimed.count === 0) return null
    return applyPTR(tx, matchId)
  })
}

// Removes a pending match (withdrawn by its recorder or rejected by another
// player). Pending matches haven't touched anyone's rating or stats. Once a
// match is confirmed — or saved as a friendly — it stays in the record and
// can't be deleted.
export async function deleteMatch(matchId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } })
  if (!existing) return { error: 'Match not found' }
  if (existing.status !== 'pending') return { error: 'Confirmed matches can’t be deleted — only pending ones can be removed' }
  const perms = await matchPermissions(matchId, userId)
  if (!perms.canDelete) return { error: 'Only players in this match can remove it' }

  return prisma.$transaction(async tx => {
    // Re-checked inside the transaction in case it was confirmed meanwhile.
    const match = await tx.match.findUnique({ where: { id: matchId } })
    if (!match) return { error: 'Match not found' }
    if (match.status !== 'pending') return { error: 'Confirmed matches can’t be deleted — only pending ones can be removed' }

    await tx.match.delete({ where: { id: matchId } }) // sets + history cascade
    await tx.matchDeletion.create({
      data: {
        matchId,
        wasPending: match.status === 'pending',
        wasRanked: match.isRanked || match.becameFriendly,
        byRecorder: match.recordedById === userId,
        matchSubmittedAt: match.submittedAt,
      },
    })
    return { ok: true as const }
  })
}

// ---------------------------------------------------------------------------
// Internal rating application (runs inside a transaction)
// ---------------------------------------------------------------------------

type TxClient = Prisma.TransactionClient

function tallySets(sets: { teamAGames: number; teamBGames: number }[]) {
  const played = sets.filter(s => s.teamAGames + s.teamBGames > 0)
  const tbWonA = sets.filter(s => s.teamAGames === 7 && s.teamBGames === 6).length
  const tbWonB = sets.filter(s => s.teamBGames === 7 && s.teamAGames === 6).length
  return {
    setsA: played.filter(s => s.teamAGames > s.teamBGames).length,
    setsB: played.filter(s => s.teamBGames > s.teamAGames).length,
    gamesA: played.reduce((acc, s) => acc + s.teamAGames, 0),
    gamesB: played.reduce((acc, s) => acc + s.teamBGames, 0),
    tbWonA,
    tbWonB,
    tbTotal: tbWonA + tbWonB,
  }
}

// Applies a match's result to all four players using their ratings at the
// moment of confirmation, and marks the match complete.
async function applyPTR(tx: TxClient, matchId: string): Promise<{ ptrDelta: number; isUpset: boolean }> {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { sets: { orderBy: { setNumber: 'asc' } } } })
  const ids = [match.teamAPlayer1Id, match.teamAPlayer2Id, match.teamBPlayer1Id, match.teamBPlayer2Id]
  const rows = await tx.player.findMany({ where: { id: { in: ids } } })
  const byId = new Map(rows.map(p => [p.id, p]))
  const [p1, p2, p3, p4] = ids.map(id => byId.get(id)!)
  const winner = match.winner as Side
  const sets = match.sets.map(s => ({ teamAGames: s.teamAGames, teamBGames: s.teamBGames }))

  const teamAPTRBefore = (p1.ptr + p2.ptr) / 2
  const teamBPTRBefore = (p3.ptr + p4.ptr) / 2

  // Each player's reliability on the day this match was played: decayed for
  // any time since their previous ranked match (see ptr-algorithm.ts).
  const rel = [p1, p2, p3, p4].map(p => currentReliability(p.reliability, p.lastRankedPlayedAt, match.playedAt))
  const result = calculatePTRChanges(
    [p1.ptr, p2.ptr],
    [p3.ptr, p4.ptr],
    [rel[0], rel[1]],
    [rel[2], rel[3]],
    sets.map((s, i) => ({ setNumber: i + 1, ...s })),
    winner,
  )
  const t = tallySets(sets)
  const deltas = [result.playerADeltas[0], result.playerADeltas[1], result.playerBDeltas[0], result.playerBDeltas[1]]

  await Promise.all([
    ...[p1, p2, p3, p4].map((p, i) => {
      const onA = i < 2
      const delta = deltas[i]
      const isWinner = (winner === 'A') === onA
      const newMatches = p.matchesPlayed + 1
      const newReliability = reliabilityAfterMatch(rel[i])
      const lastPlayed = p.lastRankedPlayedAt && p.lastRankedPlayedAt > match.playedAt ? p.lastRankedPlayedAt : match.playedAt
      const newStreak = isWinner
        ? (p.currentStreak > 0 ? p.currentStreak + 1 : 1)
        : (p.currentStreak < 0 ? p.currentStreak - 1 : -1)
      return Promise.all([
        tx.player.update({
          where: { id: p.id },
          data: {
            ptr: p.ptr + delta,
            matchesPlayed: newMatches,
            reliability: newReliability,
            lastRankedPlayedAt: lastPlayed,
            wins: isWinner ? p.wins + 1 : p.wins,
            losses: isWinner ? p.losses : p.losses + 1,
            setsWon: p.setsWon + (onA ? t.setsA : t.setsB),
            setsLost: p.setsLost + (onA ? t.setsB : t.setsA),
            gamesWon: p.gamesWon + (onA ? t.gamesA : t.gamesB),
            gamesLost: p.gamesLost + (onA ? t.gamesB : t.gamesA),
            tiebreaksWon: p.tiebreaksWon + (onA ? t.tbWonA : t.tbWonB),
            tiebreaksPlayed: p.tiebreaksPlayed + t.tbTotal,
            currentStreak: newStreak,
            bestStreak: isWinner ? Math.max(p.bestStreak, newStreak) : p.bestStreak,
          },
        }),
        tx.pTRHistory.create({
          data: {
            playerId: p.id,
            matchId,
            ptrBefore: p.ptr,
            ptrAfter: p.ptr + delta,
            delta,
            reliability: newReliability,
          },
        }),
      ])
    }),
    tx.match.update({
      where: { id: matchId },
      data: {
        status: 'complete',
        confirmedAt: new Date(),
        teamAPTRBefore,
        teamBPTRBefore,
        teamAPTRAfter: teamAPTRBefore + result.teamADelta,
        teamBPTRAfter: teamBPTRBefore + result.teamBDelta,
        ptrDelta: Math.abs(result.teamADelta),
        scoreMultiplier: result.scoreMultiplier,
        isUpset: result.isUpset,
        matchQuality: result.matchQuality,
      },
    }),
  ])

  return { ptrDelta: Math.abs(result.teamADelta), isUpset: result.isUpset }
}

// Sign-up name and email, for the edit-profile panel.
export async function getAccount(userId: string): Promise<{ name: string; email: string } | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
}

export async function getUserName(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  return u?.name ?? null
}

// A cheap fingerprint of everything the signed-in pages show. It changes
// whenever a match is recorded, confirmed or deleted, or any player's rating
// or profile changes (Player.updatedAt moves on every rating update). Clients
// poll it and only re-render when it differs.
export async function getSyncFingerprint(): Promise<string> {
  const [matches, players] = await Promise.all([
    prisma.match.aggregate({ _count: true, _max: { submittedAt: true, confirmedAt: true, scoreConfirmedAt: true } }),
    prisma.player.aggregate({ _count: true, _max: { updatedAt: true } }),
  ])
  return [
    matches._count,
    matches._max.submittedAt?.getTime() ?? 0,
    matches._max.confirmedAt?.getTime() ?? 0,
    matches._max.scoreConfirmedAt?.getTime() ?? 0,
    players._count,
    players._max.updatedAt?.getTime() ?? 0,
  ].join('.')
}

// Places this player has recorded matches at, most recent first.
export type LocationOption = { clubId: string | null; label: string }

const clubLabel = (c: { name: string; area: string }) => `${c.name}, ${c.area}`
const byLabel = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true })

// Every active club for the location picker, A–Z ("¡PADEL PADEL!" under P).
export async function getClubs(): Promise<LocationOption[]> {
  const clubs = await prisma.club.findMany({ where: { active: true }, select: { id: true, name: true, area: true } })
  return clubs.map(c => ({ clubId: c.id, label: clubLabel(c) })).sort((a, b) => byLabel(a.label, b.label))
}

// Where you've played, most recently played first (by match date). Listed
// clubs show their current name; other venues their free-text location.
export async function getRecentLocations(playerId: string, limit = 10): Promise<LocationOption[]> {
  const rows = await prisma.match.findMany({
    where: { AND: [involving(playerId), { OR: [{ clubId: { not: null } }, { location: { not: null } }] }] },
    select: { location: true, club: { select: { id: true, name: true, area: true, active: true } } },
    orderBy: [{ playedAt: 'desc' }, { submittedAt: 'desc' }],
    take: 100,
  })
  const seen = new Set<string>()
  const out: LocationOption[] = []
  for (const r of rows) {
    if (r.club && !r.club.active) continue
    const option = r.club ? { clubId: r.club.id, label: clubLabel(r.club) } : { clubId: null, label: r.location! }
    const key = option.clubId ?? option.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(option)
    if (out.length === limit) break
  }
  return out
}
