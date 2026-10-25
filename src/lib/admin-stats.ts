import { prisma } from '@/lib/prisma'
import { levelFromInternal } from '@/lib/lta'

// Everything on the admin analytics page for one time period, computed in
// one pass. Fine at this scale (hundreds of players); move to SQL aggregates
// if it gets slow.

const DAY = 864e5

export const PERIODS = {
  '1w': { label: '1 week', days: 7 },
  '4w': { label: '4 weeks', days: 28 },
  '12w': { label: '12 weeks', days: 84 },
  all: { label: 'All time', days: null },
} as const
export type Period = keyof typeof PERIODS
export const parsePeriod = (p: string | undefined): Period => (p && p in PERIODS ? (p as Period) : '4w')

export type KciStatus = 'green' | 'amber' | 'red' | 'none'

// Red/amber/green thresholds for every rated indicator — the one place to
// change them. `higher`: higher values are better (green at ≥ green, amber at
// ≥ amber); otherwise lower is better (green below green, amber below amber).
// Rates are 0–1; times are hours.
export const THRESHOLDS = {
  // Key indicators (agreed)
  rankedKept: { higher: true, green: 0.95, amber: 0.9 },
  unlistedVenues: { higher: false, green: 0.02, amber: 0.05 },
  // Proposed — review
  activation: { higher: true, green: 0.6, amber: 0.4 },
  retention4w: { higher: true, green: 0.4, amber: 0.25 },
  dormant: { higher: false, green: 0.2, amber: 0.35 },
  opponentConfirmed: { higher: true, green: 0.8, amber: 0.6 },
  hoursToConfirm: { higher: false, green: 12, amber: 24 },
  deletedShare: { higher: false, green: 0.03, amber: 0.08 },
  selfRatingDrift: { higher: false, green: 0.25, amber: 0.5 },
  upsetRate: { higher: false, green: 0.3, amber: 0.4 },
  guestHoursToJoin: { higher: false, green: 24, amber: 48 },
  circleOf3: { higher: true, green: 0.5, amber: 0.3 },
  rankedShare: { higher: true, green: 0.7, amber: 0.5 },
  errorsPerActiveDay: { higher: false, green: 0.02, amber: 0.05 },
  emailDailyUse: { higher: false, green: 0.5, amber: 0.8 },
  databaseUse: { higher: false, green: 0.5, amber: 0.8 },
} as const
type Band = { higher: boolean; green: number; amber: number }

function rag(value: number | null, b: Band): KciStatus {
  if (value === null || Number.isNaN(value)) return 'none'
  if (b.higher) return value >= b.green ? 'green' : value >= b.amber ? 'amber' : 'red'
  return value < b.green ? 'green' : value < b.amber ? 'amber' : 'red'
}

const fmtPct = (r: number) => `${Math.round(r * 100)}%`
const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h < 10 ? h.toFixed(1) : Math.round(h)} h`)
const fmtLevel = (l: number) => l.toFixed(2)

function bandText(b: Band, fmt: (v: number) => string): string {
  return b.higher
    ? `Green ≥${fmt(b.green)} · amber ≥${fmt(b.amber)} · red below ${fmt(b.amber)}`
    : `Green below ${fmt(b.green)} · amber below ${fmt(b.amber)} · red ${fmt(b.amber)}+`
}

export type Indicator = { label: string; value: string; status: KciStatus | 'info'; note: string; bands?: string }

function indicator(label: string, value: number | null, band: Band | null, fmt: (v: number) => string, note: string): Indicator {
  return {
    label,
    value: value === null ? '–' : fmt(value),
    status: band ? rag(value, band) : 'info',
    note,
    bands: band ? bandText(band, fmt) : undefined,
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2
}

// Chart buckets: days for up to a month, weeks (starting Monday) up to half
// a year, months beyond that. All UTC.
type Grain = 'day' | 'week' | 'month'
function bucketStart(d: Date, grain: Grain): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  if (grain === 'day') return day
  if (grain === 'week') return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
function nextBucket(d: Date, grain: Grain): Date {
  if (grain === 'day') return new Date(d.getTime() + DAY)
  if (grain === 'week') return new Date(d.getTime() + 7 * DAY)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}
const bucketLabel = (d: Date, grain: Grain) =>
  d.toLocaleDateString('en-GB', grain === 'month' ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })

export async function getAdminStats(period: Period) {
  const now = new Date()

  const [users, players, matches, history, errorsAll] = await Promise.all([
    prisma.user.findMany({ select: { id: true, createdAt: true } }),
    prisma.player.findMany({ select: { id: true, name: true, userId: true, createdById: true, createdAt: true, ptr: true, startingLevel: true, user: { select: { createdAt: true } } } }),
    // Matches set up in advance count from when they're played and scored.
    prisma.match.findMany({
      where: { status: { not: 'scheduled' } },
      select: {
        submittedAt: true, playedAt: true, status: true, isRanked: true, becameFriendly: true, location: true,
        autoConfirmed: true, scoreConfirmedAt: true, isUpset: true,
        club: { select: { name: true, area: true } },
        teamAPlayer1Id: true, teamAPlayer2Id: true, teamBPlayer1Id: true, teamBPlayer2Id: true,
      },
    }),
    prisma.pTRHistory.findMany({ select: { playerId: true, ptrBefore: true, ptrAfter: true, createdAt: true, adjustmentId: true }, orderBy: { createdAt: 'asc' } }),
    prisma.errorLog.count(),
  ])

  // --- The window ------------------------------------------------------------
  const days = PERIODS[period].days
  const earliest = [...users.map(u => u.createdAt), ...matches.map(m => m.submittedAt)].reduce((min, d) => (d < min ? d : min), now)
  const start = days ? new Date(now.getTime() - days * DAY) : earliest
  const spanDays = (now.getTime() - start.getTime()) / DAY
  const grain: Grain = spanDays <= 31 ? 'day' : spanDays <= 183 ? 'week' : 'month'
  const inWindow = (d: Date) => d >= start && d <= now

  const buckets: Date[] = []
  for (let b = bucketStart(start, grain); b <= now; b = nextBucket(b, grain)) buckets.push(b)
  const indexOf = new Map(buckets.map((b, i) => [b.getTime(), i]))
  const bucketOf = (d: Date) => indexOf.get(bucketStart(d, grain).getTime()) ?? -1
  const series = <T,>(rows: T[], date: (r: T) => Date, key: (r: T) => string = () => 'count') => {
    const out = buckets.map(b => ({ label: bucketLabel(b, grain) }) as Record<string, number | string | null>)
    for (const r of rows) {
      const d = date(r)
      if (!inWindow(d)) continue
      const i = bucketOf(d)
      if (i < 0) continue
      const k = key(r)
      out[i][k] = ((out[i][k] as number) ?? 0) + 1
    }
    return out
  }

  const [signIns, activeDays, errors, errorCount, deletions, resets, events, dbSize] = await Promise.all([
    prisma.signIn.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    // From a week before the window (for 4-week retention) or 30 days ago (dormant), whichever is earlier.
    prisma.activeDay.findMany({ where: { day: { gte: bucketStart(new Date(Math.min(start.getTime() - 7 * DAY, now.getTime() - 30 * DAY)), 'day') } }, select: { userId: true, day: true } }),
    prisma.errorLog.findMany({ where: { createdAt: { gte: start } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.errorLog.count({ where: { createdAt: { gte: start } } }),
    prisma.matchDeletion.findMany({ where: { createdAt: { gte: start } }, select: { wasPending: true, byRecorder: true } }),
    prisma.passwordReset.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    Promise.all([
      prisma.americanoEvent.count({ where: { createdAt: { gte: start } } }),
      prisma.roundRobinEvent.count({ where: { createdAt: { gte: start } } }),
      prisma.snakeLaddersEvent.count({ where: { createdAt: { gte: start } } }),
    ]),
    prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`.then(r => Number(r[0]?.bytes ?? 0)).catch(() => null),
  ])

  const registered = players.filter(p => p.userId)
  const guests = players.filter(p => !p.userId)
  const claimed = registered.filter(p => p.createdById)
  const matchesIn = matches.filter(m => inWindow(m.submittedAt))
  // Split by how the match was recorded: one turned friendly still counts as ranked.
  const recordedRanked = (m: { isRanked: boolean; becameFriendly: boolean }) => m.isRanked || m.becameFriendly

  // --- Adoption & usage -------------------------------------------------------
  const signups = series(users, u => u.createdAt)
  const matchesRecorded = series(matches, m => m.submittedAt, m => (recordedRanked(m) ? 'ranked' : 'friendly'))
  const signInSeries = series(signIns, s => s.createdAt)
  // Active days are whole UTC days, so the window starts at the start of its first day.
  const activeInWindow = activeDays.filter(a => a.day >= bucketStart(start, 'day'))
  const activeSeries = buckets.map((b, i) => ({
    label: bucketLabel(b, grain),
    count: new Set(activeInWindow.filter(a => bucketOf(a.day) === i).map(a => a.userId)).size as number | null,
  }))
  // Tracking started with the analytics feature; buckets before it are unknown, not zero.
  const firstTracked = [...activeDays.map(a => a.day), ...signIns.map(s => s.createdAt)].reduce<Date | null>((min, d) => (!min || d < min ? d : min), null)
  const trackedFrom = firstTracked ? bucketOf(firstTracked) : buckets.length
  for (const s of [activeSeries, signInSeries] as Record<string, number | string | null>[][]) {
    s.forEach((p, i) => { p.count = i < trackedFrom ? null : (p.count ?? 0) })
  }
  const activeIn = new Set(activeInWindow.map(a => a.userId)).size
  const active7d = new Set(activeDays.filter(a => a.day.getTime() >= now.getTime() - 7 * DAY).map(a => a.userId)).size

  // Who was active in the period — name, last active, days active and
  // matches only (no contact or profile details), most recent first.
  const playerByUser = new Map(players.filter(p => p.userId).map(p => [p.userId!, p]))
  const activeByUser = new Map<string, { days: number; last: Date }>()
  for (const a of activeInWindow) {
    const cur = activeByUser.get(a.userId) ?? { days: 0, last: a.day }
    cur.days++
    if (a.day > cur.last) cur.last = a.day
    activeByUser.set(a.userId, cur)
  }
  const matchesInByPlayer = new Map<string, number>()
  for (const m of matchesIn) {
    for (const id of [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]) matchesInByPlayer.set(id, (matchesInByPlayer.get(id) ?? 0) + 1)
  }
  const activePlayers = Array.from(activeByUser.entries())
    .map(([userId, a]) => {
      const p = playerByUser.get(userId)
      return p ? { id: p.id, name: p.name, lastActive: a.last.toISOString().slice(0, 10), days: a.days, matches: matchesInByPlayer.get(p.id) ?? 0 } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((x, y) => y.lastActive.localeCompare(x.lastActive) || y.days - x.days)

  // --- Ranked matches turned friendly (a guest didn't join within 48 hours) ---
  const rankedIn = matchesIn.filter(recordedRanked)
  const convertedSeries = buckets.map((b, i) => {
    const inBucket = rankedIn.filter(m => bucketOf(m.submittedAt) === i)
    return { label: bucketLabel(b, grain), count: inBucket.filter(m => m.becameFriendly).length, ranked: inBucket.length }
  })

  // --- KCIs -----------------------------------------------------------------
  // Of ranked matches recorded in the period that have been decided (pending
  // ones could still go either way), the share that stayed ranked.
  const decided = rankedIn.filter(m => m.status === 'complete')
  const kept = decided.filter(m => !m.becameFriendly).length
  const pending = rankedIn.filter(m => m.status === 'pending').length
  // Of new matches with a venue, the share typed in as "My venue isn't listed".
  const withVenue = matchesIn.filter(m => m.club || m.location?.trim())
  const unlistedNew = withVenue.filter(m => !m.club).length
  // New accounts: a direct sign-up, or a guest added to a match who then joined.
  const newPlayers = registered.filter(p => p.user && inWindow(p.user.createdAt))
  const viaMatch = newPlayers.filter(p => p.createdById).length
  const keptRate = decided.length ? kept / decided.length : null
  const unlistedRate = withVenue.length ? unlistedNew / withVenue.length : null

  // --- Venues (matches recorded in the period) ------------------------------
  const venues = new Map<string, { venue: string; listed: boolean; matches: number; lastPlayed: Date }>()
  for (const m of matchesIn) {
    const label = m.club ? `${m.club.name}, ${m.club.area}` : m.location?.trim()
    if (!label) continue
    const key = m.club ? `club:${label}` : `text:${label.toLowerCase().replace(/\s+/g, ' ')}`
    const v = venues.get(key) ?? { venue: label, listed: !!m.club, matches: 0, lastPlayed: m.playedAt }
    v.matches++
    if (m.playedAt > v.lastPlayed) v.lastPlayed = m.playedAt
    venues.set(key, v)
  }
  const venueRows = Array.from(venues.values()).sort((a, b) => b.matches - a.matches || b.lastPlayed.getTime() - a.lastPlayed.getTime())
  const noVenue = matchesIn.length - withVenue.length

  // --- Circles: a snapshot of now (same rule as getCircleIds) ---------------
  const registeredIds = new Set(registered.map(p => p.id))
  const circle = new Map<string, Set<string>>(registered.map(p => [p.id, new Set()]))
  for (const m of matches) {
    if (m.status !== 'complete' || !m.isRanked) continue
    const ids = [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]
    for (const a of ids) for (const b of ids) if (a !== b && registeredIds.has(b)) circle.get(a)?.add(b)
  }
  const sizes = Array.from(circle.values()).map(s => s.size).sort((a, b) => a - b)
  const circleBuckets: [string, (n: number) => boolean][] = [
    ['0', n => n === 0], ['1', n => n === 1], ['2–3', n => n >= 2 && n <= 3],
    ['4–6', n => n >= 4 && n <= 6], ['7–10', n => n >= 7 && n <= 10], ['11+', n => n >= 11],
  ]
  const circleHistogram = circleBuckets.map(([size, test]) => ({ size, players: sizes.filter(test).length }))
  const circleMedian = median(sizes) ?? 0
  const mean = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0

  // --- Average rating of all registered players, at the end of each bucket --
  // Each player counts from when they joined, at their rating at that moment.
  const byPlayer = new Map<string, { at: number; ptr: number }[]>()
  for (const h of history) {
    if (!registeredIds.has(h.playerId)) continue
    const list = byPlayer.get(h.playerId) ?? []
    list.push({ at: h.createdAt.getTime(), ptr: h.ptrAfter })
    byPlayer.set(h.playerId, list)
  }
  const timelines = registered.map(p => {
    const joined = Math.max(p.createdAt.getTime(), p.user?.createdAt.getTime() ?? 0)
    const first = history.find(h => h.playerId === p.id)
    return { joined, points: [{ at: joined, ptr: first?.ptrBefore ?? p.ptr }, ...(byPlayer.get(p.id) ?? [])] }
  })
  const averageAt = (t: number) => {
    let sum = 0, n = 0
    for (const tl of timelines) {
      if (tl.joined > t) continue
      let ptr = tl.points[0].ptr
      for (const pt of tl.points) if (pt.at <= t) ptr = pt.ptr
      sum += ptr
      n++
    }
    return n ? Number(levelFromInternal(sum / n).toFixed(2)) : null
  }
  const ratingSeries = buckets.map(b => ({ label: bucketLabel(b, grain), level: averageAt(Math.min(nextBucket(b, grain).getTime() - 1, now.getTime())) }))
  const ratingNow = averageAt(now.getTime())
  const ratingThen = averageAt(start.getTime()) ?? ratingSeries.find(p => p.level !== null)?.level ?? null

  // ===========================================================================
  // Section indicators
  // ===========================================================================
  const T = THRESHOLDS
  const joinedAt = (p: (typeof registered)[number]) => p.user!.createdAt.getTime()
  const matchTimes = new Map<string, number[]>()
  for (const m of matches) {
    for (const id of [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]) {
      const list = matchTimes.get(id) ?? []
      list.push(m.submittedAt.getTime())
      matchTimes.set(id, list)
    }
  }
  const activeTimes = new Map<string, number[]>()
  for (const a of activeDays) {
    const list = activeTimes.get(a.userId) ?? []
    list.push(a.day.getTime())
    activeTimes.set(a.userId, list)
  }
  const usedBetween = (p: (typeof registered)[number], from: number, to: number) =>
    (matchTimes.get(p.id) ?? []).some(t => t >= from && t < to) || (activeTimes.get(p.userId!) ?? []).some(t => t >= from && t < to)

  // --- Retention ---
  // Activation: joined in the period, at least 7 days ago, and in a match by
  // day 7 (a claimed guest's match before joining counts — they played).
  const activationCohort = registered.filter(p => p.user && inWindow(p.user.createdAt) && joinedAt(p) <= now.getTime() - 7 * DAY)
  const activated = activationCohort.filter(p => (matchTimes.get(p.id) ?? []).some(t => t <= joinedAt(p) + 7 * DAY)).length
  // 4-week retention: players whose fourth week (days 21–28) ended in the
  // period, and who played or opened the app during it.
  const retentionCohort = registered.filter(p => p.user && joinedAt(p) + 28 * DAY >= start.getTime() && joinedAt(p) + 28 * DAY <= now.getTime())
  const retained = retentionCohort.filter(p => usedBetween(p, joinedAt(p) + 21 * DAY, joinedAt(p) + 28 * DAY)).length
  // Dormant (now): joined over 30 days ago, nothing in the last 30 days.
  const dormantBase = registered.filter(p => p.user && joinedAt(p) <= now.getTime() - 30 * DAY)
  const dormantPlayers = dormantBase.filter(p => !usedBetween(p, now.getTime() - 30 * DAY, now.getTime() + 1))
  const lastMatch = (id: string) => Math.max(0, ...(matchTimes.get(id) ?? []))
  const activationRate = activationCohort.length ? activated / activationCohort.length : null
  const retentionRate = retentionCohort.length ? retained / retentionCohort.length : null
  const dormantRate = dormantBase.length ? dormantPlayers.length / dormantBase.length : null

  // --- Match health ---
  const settledRanked = matchesIn.filter(m => m.status === 'complete' && m.isRanked)
  const byOpponent = settledRanked.filter(m => m.scoreConfirmedAt && !m.autoConfirmed)
  const confirmHours = matchesIn.filter(m => m.scoreConfirmedAt).map(m => (m.scoreConfirmedAt!.getTime() - m.submittedAt.getTime()) / 36e5)
  const medianConfirm = median(confirmHours)
  const rejected = deletions.filter(d => d.wasPending && !d.byRecorder).length
  const deletedShare = matchesIn.length + deletions.length ? deletions.length / (matchesIn.length + deletions.length) : null
  const opponentRate = settledRanked.length ? byOpponent.length / settledRanked.length : null

  // --- Rating integrity ---
  // Self-rating: the level picked at sign-up against the level after 10 ranked matches.
  const historyByPlayer = new Map<string, typeof history>()
  // Matches only: manual adjustments aren't results.
  for (const h of history) if (!h.adjustmentId) historyByPlayer.set(h.playerId, [...(historyByPlayer.get(h.playerId) ?? []), h])
  const drifts = registered
    .filter(p => p.startingLevel !== null && (historyByPlayer.get(p.id)?.length ?? 0) >= 10)
    .map(p => levelFromInternal(historyByPlayer.get(p.id)![9].ptrAfter) - p.startingLevel!)
  const meanDrift = drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : null
  const droppedShare = drifts.length ? drifts.filter(d => d < 0).length / drifts.length : 0
  const upsets = settledRanked.filter(m => m.isUpset).length
  const upsetRate = settledRanked.length ? upsets / settledRanked.length : null
  const levelBands = ['1', '2', '3', '4', '5', '6–7'].map((label, i) => ({ size: label, players: 0, lo: i + 1, hi: i === 5 ? 7.01 : i + 2 }))
  for (const p of registered) {
    const l = levelFromInternal(p.ptr)
    const band = levelBands.find(b => l >= b.lo && l < b.hi)
    if (band) band.players++
  }

  // --- Growth ---
  const guestsAdded = players.filter(p => p.createdById && inWindow(p.createdAt)).length
  const rankedRecordedIn = rankedIn.length
  const guestJoinHours = registered
    .filter(p => p.createdById && p.user && inWindow(p.user.createdAt))
    .map(p => (p.user!.createdAt.getTime() - p.createdAt.getTime()) / 36e5)
  const medianGuestJoin = median(guestJoinHours)
  const circleOf3 = sizes.length ? sizes.filter(n => n >= 3).length / sizes.length : null

  // --- Feature usage ---
  const rankedShare = matchesIn.length ? rankedIn.length / matchesIn.length : null
  const [americano, roundRobin, snakes] = events
  const eventTotal = americano + roundRobin + snakes

  // --- Reliability & running costs ---
  const activeDaysIn = activeInWindow.length
  const errorRate = activeDaysIn ? errorCount / activeDaysIn : null
  const emailLimit = Number(process.env.EMAIL_DAILY_LIMIT) || 100
  const resetsByDay = new Map<string, number>()
  for (const r of resets) resetsByDay.set(r.createdAt.toISOString().slice(0, 10), (resetsByDay.get(r.createdAt.toISOString().slice(0, 10)) ?? 0) + 1)
  const busiestEmailDay = Math.max(0, ...Array.from(resetsByDay.values()))
  const dbLimitMb = Number(process.env.DB_SIZE_LIMIT_MB) || 512
  const dbMb = dbSize === null ? null : dbSize / 1024 / 1024

  const sections = {
    retention: [
      indicator('Activation', activationRate, T.activation, fmtPct, `${activated} of ${activationCohort.length} new players were in a match within 7 days of joining`),
      indicator('4-week retention', retentionRate, T.retention4w, fmtPct, `${retained} of ${retentionCohort.length} players still playing or opening the app in their 4th week`),
      indicator('Dormant players', dormantRate, T.dormant, fmtPct, `${dormantPlayers.length} of ${dormantBase.length} players who joined 30+ days ago have done nothing for 30 days (now)`),
    ],
    matchHealth: [
      indicator('Confirmed by an opponent', opponentRate, T.opponentConfirmed, fmtPct, `${byOpponent.length} of ${settledRanked.length} confirmed ranked matches — the rest confirmed themselves after 48 h`),
      indicator('Median time to confirm', medianConfirm, T.hoursToConfirm, fmtHours, `From recording to an opponent confirming, across ${confirmHours.length} matches`),
      indicator('Deleted or rejected', deletedShare, T.deletedShare, fmtPct, `${deletions.length} deleted (${rejected} rejected by an opponent) of ${matchesIn.length + deletions.length} recorded · tracked from 12 Oct 2026`),
    ],
    ratings: [
      indicator('Self-rating drift', meanDrift === null ? null : Math.abs(meanDrift), T.selfRatingDrift, fmtLevel,
        drifts.length
          ? `Level after 10 ranked matches is ${meanDrift! >= 0 ? '+' : '−'}${Math.abs(meanDrift!).toFixed(2)} vs the level picked at sign-up on average · ${fmtPct(droppedShare)} of ${drifts.length} players dropped · all time`
          : 'No player has 10 ranked matches yet · all time'),
      indicator('Upset rate', upsetRate, T.upsetRate, fmtPct, `${upsets} of ${settledRanked.length} confirmed ranked matches won by the lower-rated pair`),
    ],
    growth: [
      indicator('Guests added per ranked match', rankedRecordedIn ? guestsAdded / rankedRecordedIn : null, null, v => v.toFixed(2), `${guestsAdded} guests added across ${rankedRecordedIn} ranked matches · context, no rating`),
      indicator('Time for guests to join', medianGuestJoin, T.guestHoursToJoin, fmtHours, `Median from being added to signing up, ${guestJoinHours.length} guests · ranked matches are lost after 48 h`),
      indicator('Players with a circle of 3+', circleOf3, T.circleOf3, fmtPct, `${sizes.filter(n => n >= 3).length} of ${sizes.length} players have 3+ opponents to rank against (now)`),
    ],
    features: [
      indicator('Ranked share of matches', rankedShare, T.rankedShare, fmtPct, `${rankedIn.length} ranked of ${matchesIn.length} matches recorded`),
      indicator('Events created', eventTotal, null, v => String(v), `Americano ${americano} · round robin ${roundRobin} · snakes & ladders ${snakes} · context, no rating`),
    ],
    reliability: [
      indicator('Errors per active player-day', errorRate, T.errorsPerActiveDay, v => v.toFixed(3), `${errorCount} errors across ${activeDaysIn} player-days of use`),
      indicator('Email limit, busiest day', busiestEmailDay / emailLimit, T.emailDailyUse, fmtPct, `${busiestEmailDay} reset emails on the busiest day, of ${emailLimit} a day (EMAIL_DAILY_LIMIT)`),
      indicator('Database size', dbMb === null ? null : dbMb / dbLimitMb, T.databaseUse, fmtPct, dbMb === null ? 'Could not read the database size' : `${dbMb.toFixed(0)} MB of ${dbLimitMb} MB (DB_SIZE_LIMIT_MB) · now`),
    ],
  }

  return {
    period,
    sections,
    levels: levelBands.map(({ size, players }) => ({ size, players })),
    dormant: dormantPlayers
      .sort((a, b) => lastMatch(b.id) - lastMatch(a.id))
      .slice(0, 20)
      .map(p => ({ id: p.id, name: p.name, lastMatch: lastMatch(p.id) ? new Date(lastMatch(p.id)).toISOString().slice(0, 10) : 'Never', joined: p.user!.createdAt.toISOString().slice(0, 10) })),
    grain,
    activePlayers,
    tiles: {
      registered: registered.length,
      newInPeriod: newPlayers.length,
      activeInPeriod: activeIn,
      active7d,
      matchesInPeriod: matchesIn.length,
      matchesAllTime: matches.length,
      guests: guests.length,
      claimed: claimed.length,
    },
    kci: {
      rankedKept: { rate: keptRate, kept, decided: decided.length, pending, status: rag(keptRate, THRESHOLDS.rankedKept), bands: bandText(THRESHOLDS.rankedKept, fmtPct) },
      unlistedVenues: { rate: unlistedRate, unlisted: unlistedNew, withVenue: withVenue.length, status: rag(unlistedRate, THRESHOLDS.unlistedVenues), bands: bandText(THRESHOLDS.unlistedVenues, fmtPct) },
      newPlayers: { total: newPlayers.length, direct: newPlayers.length - viaMatch, viaMatch },
    },
    signups,
    matchesRecorded,
    activeSeries,
    signInSeries,
    converted: { series: convertedSeries, total: rankedIn.filter(m => m.becameFriendly).length, rankedTotal: rankedIn.length, pending },
    venues: venueRows.map(v => ({ ...v, lastPlayed: v.lastPlayed.toISOString().slice(0, 10) })),
    noVenue,
    circles: { histogram: circleHistogram, median: circleMedian, mean: Number(mean.toFixed(1)), players: sizes.length },
    rating: { series: ratingSeries, now: ratingNow, then: ratingThen },
    errors: errors.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
    errorCount,
    errorsAllTime: errorsAll,
  }
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>
