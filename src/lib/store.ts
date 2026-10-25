import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendEmail, appUrl } from '@/lib/email'
import { logError } from '@/lib/analytics'
import { sendPush, usersOfPlayers } from '@/lib/push'
import { LEGAL, LEGAL_VERSION } from '@/lib/legal'
import { prisma } from './prisma'
import { calculatePTRChanges, currentReliability, reliabilityAfterMatch } from './ptr-algorithm'
import { internalFromLevel, isLtaLevel, levelFromInternal } from './lta'
import { isCountryCode } from './countries'
import { setWinner } from './utils'
import type { PlayerWithStats, MatchWithPlayers, PTRHistoryPoint } from '@/types'
import type { Player, PTRHistory, Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

type PlayerWithHistory = Player & { ptrHistory?: PTRHistory[] }
type MatchFull = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>

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
    isGuest: !p.userId && !p.deletedAt,
    isDeleted: !!p.deletedAt,
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
      isAdjustment: !!h.adjustmentId,
    } satisfies PTRHistoryPoint)),
    rank,
    ptrDelta: history.filter(h => !h.adjustmentId).at(-1)?.delta ?? 0,
  }
}

function hydrateMatch(m: MatchFull, viewerDelta?: number): MatchWithPlayers {
  return {
    id: m.id,
    playedAt: m.playedAt.toISOString(),
    status: m.status as 'scheduled' | 'pending' | 'complete',
    isRanked: m.isRanked,
    organiserId: m.organiserId,
    disputed: m.disputed,
    // Score entries for a scheduled match (empty for one recorded after play).
    scoreReports: m.scoreReports.map(r => ({
      id: r.id,
      submittedBy: r.submittedBy.name,
      side: r.submittedBy.player ? sideOf(m, r.submittedBy.player.id) : null,
      sets: (r.sets as { teamAGames: number; teamBGames: number }[]).map((x, i) => ({ setNumber: i + 1, ...x })),
      winner: r.winner as 'A' | 'B' | null,
      incomplete: r.incomplete,
      status: r.status as 'open' | 'accepted' | 'rejected',
    })),
    incomplete: m.incomplete,
    winner: m.winner as 'A' | 'B' | null,
    recordedById: m.recordedById,
    submittedAt: m.submittedAt.toISOString(),
    location: m.location,
    clubId: m.clubId,
    autoConfirmAt: new Date(m.submittedAt.getTime() + AUTO_CONFIRM_MS).toISOString(),
    autoConfirmed: m.autoConfirmed,
    scoreConfirmed: !!m.scoreConfirmedAt,
    becameFriendly: m.becameFriendly,
    guests: [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]
      .filter(p => !p.userId && !p.deletedAt)
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

export const MATCH_INCLUDE = {
  teamAPlayer1: true, teamAPlayer2: true,
  teamBPlayer1: true, teamBPlayer2: true,
  sets: { orderBy: { setNumber: 'asc' as const } },
  scoreReports: { orderBy: { createdAt: 'asc' as const }, include: { submittedBy: { select: { name: true, player: { select: { id: true } } } } } },
} satisfies Prisma.MatchInclude

export function involving(playerId: string): Prisma.MatchWhereInput {
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
  if (guest?.createdById) {
    await sendPush([guest.createdById], {
      title: `${firstName(name)} joined PadelTrack`,
      body: 'Matches you played together can now count towards rankings.',
      url: `/players/${guest.id}`,
    })
  }
  // Confirmation email. A failed email never undoes the sign-up.
  try {
    await sendAccountCreatedEmail(email, name, guest ? Math.min(data.level, guest.suggestedLevel ?? data.level) : data.level)
  } catch (error) {
    await logError({ source: 'server', error, path: 'signUp → account created email', userId: result.userId })
  }
  return result
}

// The only emails PadelTrack sends are this and password resets; everything
// else is shown in the app.
async function sendAccountCreatedEmail(email: string, name: string, level: number) {
  const first = name.split(' ')[0]
  const link = appUrl('')
  await sendEmail({
    to: email,
    subject: 'Welcome to PadelTrack — your account is ready',
    text: `Hi ${first},\n\nYour PadelTrack account has been created for ${email}. Your starting level is ${level.toFixed(1)}.\n\nOpen PadelTrack: ${link}\n\nIf you didn't create this account, email ${LEGAL.contactEmail} and we'll remove it.`,
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b">
  <p style="font-size:20px;font-weight:800;margin:0 0 20px">Padel<span style="color:#f97316">Track</span></p>
  <p>Hi ${escapeHtml(first)},</p>
  <p>Your PadelTrack account has been created for <strong>${escapeHtml(email)}</strong>. Your starting level is <strong>${level.toFixed(1)}</strong>.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">Open PadelTrack</a></p>
  <p style="font-size:13px;color:#71717a">If you didn’t create this account, email <a href="mailto:${LEGAL.contactEmail}" style="color:#71717a">${LEGAL.contactEmail}</a> and we’ll remove it.</p>
</div>`,
  })
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
  if (guest.createdById && guest.createdById !== userId) {
    await sendPush([guest.createdById], {
      title: `${firstName(user?.name ?? guest.name)} joined PadelTrack`,
      body: 'Matches you played together can now count towards rankings.',
      url: `/players/${guest.id}`,
    })
  }
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
        { id: { in: playedWithIds }, userId: null, deletedAt: null },
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

// Deletes an account (confirmed with its password). Personal details are
// erased rather than the rows removed: the user row is kept, stripped, so
// matches it recorded and events it organised stay intact for everyone else.
// The player is detached from the account but keeps its name in confirmed
// matches, so other players' ratings and records don't change; with no user
// it drops out of every circle, and its profile page is gone (isDeleted).
// Pending matches it's in haven't touched any rating, so they're removed.
// Detaching the player also ends any open sessions (getSession needs one).
export async function deleteAccount(userId: string, password: string): Promise<{ ok: true } | { error: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'Account not found' }
  if (!(await bcrypt.compare(password, user.password))) return { error: 'Password is incorrect' }
  const me = await getPlayerForUser(userId)
  const unusable = await bcrypt.hash(randomBytes(32).toString('base64url'), 10)
  await prisma.$transaction(async tx => {
    if (me) {
      await tx.match.deleteMany({ where: { status: 'pending', ...involving(me.id) } })
      await tx.player.update({
        where: { id: me.id },
        data: {
          nickname: null,
          userId: null, createdById: null, claimToken: null, suggestedLevel: null,
          deletedAt: new Date(),
        },
      })
    }
    await tx.pushSubscription.deleteMany({ where: { userId } })
    await tx.passwordReset.deleteMany({ where: { userId } })
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`, name: 'Deleted player', password: unusable,
        gender: null, dateOfBirth: null, country: null,
      },
    })
  })
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

// withInvites adds guests' claim tokens to pending matches and friendlies so
// the viewer can send invite links — only pass it when playerId is the
// signed-in viewer.
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
    if (m.status === 'pending') hydrated.awaitingConfirmationFrom = confirmerNames(m, m.recordedBy.player?.id)
    if (opts?.withInvites && (m.status === 'pending' || !m.isRanked)) {
      const tokens = new Map([m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].map(p => [p.id, p.claimToken]))
      hydrated.guests = hydrated.guests.map(g => ({ ...g, claimToken: tokens.get(g.id) ?? undefined }))
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

export function sideOf(m: { teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }, playerId: string): Side | null {
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
    // A disputed score is resolved by picking an entry (confirmReport).
    canConfirm: m.status === 'pending' && !m.disputed && !m.scoreConfirmedAt && recorderSide !== null && mySide !== recorderSide,
    // A scheduled match is cancelled by its organiser instead (see deleteMatch).
    canDelete: m.status === 'pending' && !m.organiserId,
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
      // Disputed: I can settle it if someone on the other pair entered a score.
      if (m.disputed) {
        const mySide = sideOf(m, me.id)
        return m.scoreReports.some(r => r.status === 'open' && r.submittedBy.player && sideOf(m, r.submittedBy.player.id) !== mySide)
      }
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

// A score as entered: sets, plus a winner unless it didn't finish.
export function validateScore(sets: { teamAGames: number; teamBGames: number }[], winner: Side | null | undefined, incomplete: boolean): string | null {
  const setError = validateSets(sets)
  if (setError) return setError
  if (incomplete) {
    if (winner !== null && winner !== undefined) return 'An incomplete match has no winner'
    if (!sets.some(s => s.teamAGames + s.teamBGames > 0)) return 'Enter the games played so far'
    const won = (side: Side) => sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === side).length
    if (won('A') >= 2 || won('B') >= 2) return 'One pair has won two sets — save it as a finished match'
  } else if (winner !== 'A' && winner !== 'B') {
    return 'Pick a winner'
  }
  return null
}

// A scheduled match's start: an ISO timestamp from the form (the browser
// turns its local date and time into one). Up to a year ahead.
export function resolveStartsAt(startsAt: unknown): Date | null {
  if (typeof startsAt !== 'string') return null
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return null
  if (d.getTime() > Date.now() + 366 * 864e5) return null
  return d
}

export async function createMatch(userId: string, data: {
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  sets: { teamAGames: number; teamBGames: number }[]
  // Null for an incomplete match.
  winner: Side | null
  // Play stopped before either pair won 2 sets: saved with no winner and
  // never affects ratings (see the Match model).
  incomplete?: boolean
  // 'YYYY-MM-DD'. Defaults to now; past dates allowed, future dates aren't.
  playedOn?: string
  location?: string
  // A listed club; its label becomes the location.
  clubId?: string
  // Friendly matches skip confirmation and never change ratings.
  isRanked?: boolean
  // A start time in the future makes it a scheduled match: no score yet.
  startsAt?: string
}): Promise<{ matchId: string; status: 'scheduled' | 'pending' | 'complete'; ptrDelta: number; isUpset: boolean; invites: { name: string; claimToken: string }[] } | { error: string }> {
  const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner } = data
  const startsAt = data.startsAt !== undefined ? resolveStartsAt(data.startsAt) : null
  if (data.startsAt !== undefined && !startsAt) return { error: 'Pick a valid date and time' }
  const scheduled = !!startsAt && startsAt.getTime() > Date.now()
  // A start time already passed is when it was played (it needs a score).
  const playedAt = startsAt ?? resolvePlayedAt(data.playedOn)
  if (!playedAt) return { error: 'Pick a valid date that isn’t in the future' }
  const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
  if (new Set(ids).size !== 4) return { error: 'All four players must be different' }
  const incomplete = !scheduled && data.incomplete === true
  if (!scheduled) {
    const scoreError = validateScore(sets, winner, incomplete)
    if (scoreError) return { error: scoreError }
  }

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
  // Guests get an invite link either way: joining puts a friendly on their
  // profile, and lets a ranked match count.
  const invites = players.filter(p => !p.userId && p.claimToken).map(p => ({ name: p.name, claimToken: p.claimToken! }))

  if (scheduled) {
    const match = await prisma.match.create({
      data: {
        status: 'scheduled',
        playedAt,
        isRanked,
        location: club ? clubLabel(club) : data.location?.trim().slice(0, 60) || null,
        clubId: club?.id ?? null,
        recordedById: userId,
        organiserId: userId,
        teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
      },
    })
    const others = players.filter(p => p.userId && p.userId !== userId)
    await sendPush(others.map(p => p.userId), {
      title: 'You’ve been added to a match',
      body: `${firstName(me.name)} added you to a ${isRanked ? 'ranked match' : 'friendly'}: ${whenLabel(playedAt)}${match.location ? ` at ${match.location}` : ''}`,
      url: '/matches',
      tag: `match-${match.id}`,
    })
    return { matchId: match.id, status: 'scheduled', ptrDelta: 0, isUpset: false, invites }
  }

  const saved = await prisma.$transaction(async tx => {
    const match = await tx.match.create({
      data: {
        status: 'pending',
        winner: incomplete ? null : winner,
        incomplete,
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

  // Phone notification for the other pair, who can confirm it.
  if (saved.status === 'pending') {
    const byId = new Map(players.map(p => [p.id, p]))
    const theirs = mySide === 'A' ? [teamBPlayer1Id, teamBPlayer2Id] : [teamAPlayer1Id, teamAPlayer2Id]
    await sendPush(theirs.map(id => byId.get(id)?.userId), {
      title: 'Confirm your match',
      body: `${firstName(me.name)} recorded: ${resultLine(data, byId)}`,
      url: '/matches',
      tag: `match-${saved.matchId}`,
    })
  }
  return saved
}

export const firstName = (name: string) => name.split(' ')[0]

// "Sat 2 Nov, 18:00" in UK time (where the clubs are), for notifications.
export function whenLabel(d: Date): string {
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  return `${day}, ${time}`
}

// "Morgan & Riley beat Alex & Taylor 6–3 6–4" (winner's games first).
export function resultLine(
  m: { teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string; winner: string | null; sets: { teamAGames: number; teamBGames: number }[] },
  byId: Map<string, { name: string }>
): string {
  const pair = (a: string, b: string) => `${firstName(byId.get(a)?.name ?? '?')} & ${firstName(byId.get(b)?.name ?? '?')}`
  const A = pair(m.teamAPlayer1Id, m.teamAPlayer2Id)
  const B = pair(m.teamBPlayer1Id, m.teamBPlayer2Id)
  if (m.winner !== 'A' && m.winner !== 'B') {
    return `${A} v ${B} ${m.sets.map(s => `${s.teamAGames}–${s.teamBGames}`).join(' ')} (didn’t finish)`
  }
  const aWon = m.winner === 'A'
  const score = m.sets.map(s => (aWon ? `${s.teamAGames}–${s.teamBGames}` : `${s.teamBGames}–${s.teamAGames}`)).join(' ')
  return aWon ? `${A} beat ${B} ${score}` : `${B} beat ${A} ${score}`
}

// The recorder and their partner, as user ids.
async function recorderSideUsers(m: { recordedById: string; teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }): Promise<string[]> {
  const recorder = await getPlayerForUser(m.recordedById)
  const side = recorder ? sideOf(m, recorder.id) : null
  if (!side) return [m.recordedById]
  return usersOfPlayers(side === 'A' ? [m.teamAPlayer1Id, m.teamAPlayer2Id] : [m.teamBPlayer1Id, m.teamBPlayer2Id])
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
  // A scheduled match's single score entry is now accepted.
  await prisma.matchScoreReport.updateMany({ where: { matchId, status: 'open' }, data: { status: 'accepted' } })
  const result = await finalizeIfReady(matchId)
  {
    const m = await prisma.match.findUnique({ where: { id: matchId }, include: { sets: { orderBy: { setNumber: 'asc' } }, teamAPlayer1: true, teamAPlayer2: true, teamBPlayer1: true, teamBPlayer2: true } })
    const confirmer = await getPlayerForUser(userId)
    if (m) {
      const byId = new Map([m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].map(p => [p.id, p]))
      await sendPush(await recorderSideUsers(m), {
        title: 'Match confirmed',
        body: `${firstName(confirmer?.name ?? 'Your opponent')} confirmed ${resultLine(m, byId)}${result ? '' : ' — waiting for guests to join'}`,
        url: '/matches',
        tag: `match-${matchId}`,
      })
    }
  }
  return { ok: true, ranked: !!result, ptrDelta: result?.ptrDelta ?? 0 }
}

// Makes a pending match ranked once its score is confirmed and everyone in it
// is on PadelTrack. Safe to call any time; returns null if it isn't ready.
export async function finalizeIfReady(matchId: string): Promise<{ ptrDelta: number } | null> {
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
    // Disputed scores never confirm themselves.
    where: { status: 'pending', disputed: false, submittedAt: { lte: new Date(Date.now() - AUTO_CONFIRM_MS) } },
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
      if (converted.count) {
        const guests = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].filter(p => !p.userId).map(p => firstName(p.name))
        await sendPush([m.recordedById], {
          title: 'Match became a friendly',
          body: `${guests.join(' & ')} didn’t join PadelTrack within ${AUTO_CONFIRM_HOURS} hours, so your match won’t count towards ratings.`,
          url: '/matches',
          tag: `match-${m.id}`,
        })
      }
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
    const { incomplete } = await tx.match.findUniqueOrThrow({ where: { id: matchId }, select: { incomplete: true } })
    return incomplete ? applySetStats(tx, matchId) : applyPTR(tx, matchId)
  })
}

// Removes a pending match (withdrawn by its recorder or rejected by another
// player). Pending matches haven't touched anyone's rating or stats. Once a
// match is confirmed — or saved as a friendly — it stays in the record and
// can't be deleted.
export async function deleteMatch(matchId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true, organiserId: true } })
  if (!existing) return { error: 'Match not found' }
  if (existing.organiserId) return cancelScheduledMatch(matchId, userId)
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
    return { ok: true as const, match }
  }).then(async r => {
    if ('error' in r) return r
    // Rejected by another player: tell whoever recorded it.
    if (r.match.recordedById !== userId) {
      const rejecter = await getPlayerForUser(userId)
      await sendPush([r.match.recordedById], {
        title: 'Match rejected',
        body: `${firstName(rejecter?.name ?? 'A player')} rejected the match you recorded. You can record it again if needed.`,
        url: '/matches',
      })
    }
    return { ok: true as const }
  })
}

// The organiser calls off a match they set up in advance — before it's
// played, or after while no score has been confirmed. Everyone else in it is
// told.
export async function cancelScheduledMatch(matchId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const m = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE })
  if (!m || !m.organiserId) return { error: 'Match not found' }
  if (m.organiserId !== userId) return { error: 'Only the person who set up this match can cancel it' }
  if (m.status === 'complete' || m.scoreConfirmedAt) return { error: 'This match has a confirmed score, so it can’t be cancelled' }
  const gone = await prisma.match.deleteMany({ where: { id: matchId, status: { in: ['scheduled', 'pending'] }, scoreConfirmedAt: null } })
  if (gone.count === 0) return { error: 'This match has a confirmed score, so it can’t be cancelled' }
  const organiser = await getPlayerForUser(userId)
  const others = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].map(p => p.userId).filter(id => id && id !== userId)
  await sendPush(others, {
    title: 'Match cancelled',
    body: `${firstName(organiser?.name ?? 'The organiser')} cancelled the match on ${whenLabel(m.playedAt)}.`,
    url: '/matches',
    tag: `match-${matchId}`,
  })
  return { ok: true }
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
    // Only finished sets count as won (an incomplete match's last set may be
    // part-played); every game counts.
    setsA: played.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length,
    setsB: played.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length,
    gamesA: played.reduce((acc, s) => acc + s.teamAGames, 0),
    gamesB: played.reduce((acc, s) => acc + s.teamBGames, 0),
    tbWonA,
    tbWonB,
    tbTotal: tbWonA + tbWonB,
  }
}

// An incomplete ranked match, once confirmed: counts as a match played and
// adds its finished sets, all its games and any tie-breaks to the four
// players' stats. Ratings, reliability, wins/losses and streaks are untouched.
async function applySetStats(tx: TxClient, matchId: string): Promise<{ ptrDelta: number }> {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { sets: true } })
  const t = tallySets(match.sets)
  const sides: [string, boolean][] = [
    [match.teamAPlayer1Id, true], [match.teamAPlayer2Id, true],
    [match.teamBPlayer1Id, false], [match.teamBPlayer2Id, false],
  ]
  await Promise.all([
    ...sides.map(([id, onA]) => tx.player.update({
      where: { id },
      data: {
        matchesPlayed: { increment: 1 },
        setsWon: { increment: onA ? t.setsA : t.setsB },
        setsLost: { increment: onA ? t.setsB : t.setsA },
        gamesWon: { increment: onA ? t.gamesA : t.gamesB },
        gamesLost: { increment: onA ? t.gamesB : t.gamesA },
        tiebreaksWon: { increment: onA ? t.tbWonA : t.tbWonB },
        tiebreaksPlayed: { increment: t.tbTotal },
      },
    })),
    tx.match.update({ where: { id: matchId }, data: { status: 'complete', confirmedAt: new Date() } }),
  ])
  return { ptrDelta: 0 }
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

// Sign-up name and email, for the edit-profile panel, and whether profile
// details are missing (invite-link sign-ups skip them at first).
export async function getAccount(userId: string): Promise<{ name: string; email: string; profileIncomplete: boolean } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, gender: true, dateOfBirth: true, country: true } })
  if (!u) return null
  return { name: u.name, email: u.email, profileIncomplete: !u.gender || !u.dateOfBirth || !u.country }
}

// Fills in gender, date of birth and country — all three required.
export async function completeProfile(userId: string, data: { gender?: string; dateOfBirth?: string; country?: string }): Promise<{ ok: true } | { error: string }> {
  const profile = validateProfileDetails(data, true)
  if ('error' in profile) return profile
  await prisma.user.update({ where: { id: userId }, data: profile })
  return { ok: true }
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
    prisma.match.aggregate({ _count: true, _max: { submittedAt: true, confirmedAt: true, scoreConfirmedAt: true, updatedAt: true } }),
    prisma.player.aggregate({ _count: true, _max: { updatedAt: true } }),
  ])
  return [
    matches._count,
    matches._max.submittedAt?.getTime() ?? 0,
    matches._max.confirmedAt?.getTime() ?? 0,
    matches._max.scoreConfirmedAt?.getTime() ?? 0,
    matches._max.updatedAt?.getTime() ?? 0,
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
