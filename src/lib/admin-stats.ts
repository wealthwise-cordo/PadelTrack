import { prisma } from '@/lib/prisma'
import { levelFromInternal } from '@/lib/lta'

// Everything on the admin analytics page, computed in one pass. Fine at this
// scale (hundreds of players); move to SQL aggregates if it gets slow.

const DAY = 864e5
const WEEKS = 12

// Monday 00:00 UTC of the week containing `d`.
function weekStart(d: Date): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY)
}

const weekLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export type WeekPoint = { week: string; [series: string]: number | string | null }

export async function getAdminStats() {
  const now = new Date()
  const thisWeek = weekStart(now)
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * DAY))
  const from = weeks[0]
  const weekIndex = (d: Date) => Math.floor((weekStart(d).getTime() - from.getTime()) / (7 * DAY))
  const bucket = <T,>(rows: T[], date: (r: T) => Date, key: (r: T) => string = () => 'count') => {
    const out = weeks.map(w => ({ week: weekLabel(w) }) as Record<string, number | string>)
    for (const r of rows) {
      const i = weekIndex(date(r))
      if (i < 0 || i >= WEEKS) continue
      const k = key(r)
      out[i][k] = ((out[i][k] as number) ?? 0) + 1
    }
    return out
  }

  const [users, players, matches, history, signIns, activeDays, errors, errors7d] = await Promise.all([
    prisma.user.findMany({ select: { id: true, createdAt: true } }),
    prisma.player.findMany({ select: { id: true, userId: true, createdById: true, createdAt: true, ptr: true, user: { select: { createdAt: true } } } }),
    prisma.match.findMany({
      select: {
        submittedAt: true, playedAt: true, status: true, isRanked: true, becameFriendly: true, location: true,
        club: { select: { name: true, area: true } },
        teamAPlayer1Id: true, teamAPlayer2Id: true, teamBPlayer1Id: true, teamBPlayer2Id: true,
      },
    }),
    prisma.pTRHistory.findMany({ select: { playerId: true, ptrBefore: true, ptrAfter: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.signIn.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true } }),
    prisma.activeDay.findMany({ where: { day: { gte: new Date(Math.min(from.getTime(), now.getTime() - 30 * DAY)) } }, select: { userId: true, day: true } }),
    prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.errorLog.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
  ])

  // --- Adoption -------------------------------------------------------------
  const registered = players.filter(p => p.userId)
  const guests = players.filter(p => !p.userId)
  const claimed = registered.filter(p => p.createdById)
  const activeSince = (days: number) => new Set(activeDays.filter(a => a.day.getTime() >= now.getTime() - days * DAY).map(a => a.userId)).size

  const signupsByWeek = bucket(users, u => u.createdAt)
  // Split by how the match was recorded: one turned friendly still counts as ranked here.
  const recordedRanked = (m: { isRanked: boolean; becameFriendly: boolean }) => m.isRanked || m.becameFriendly
  const matchesByWeek = bucket(matches, m => m.submittedAt, m => (recordedRanked(m) ? 'ranked' : 'friendly'))

  // Ranked matches turned into friendlies because a guest didn't join within
  // 48 hours, so they never reached anyone's rating history. By the week the
  // match was recorded, beside how many ranked matches were recorded.
  const rankedRecorded = matches.filter(recordedRanked)
  const converted = matches.filter(m => m.becameFriendly)
  const stillPending = matches.filter(m => m.isRanked && m.status === 'pending').length
  const convertedByWeek = weeks.map((w, i) => {
    const inWeek = rankedRecorded.filter(m => weekIndex(m.submittedAt) === i)
    const lost = inWeek.filter(m => m.becameFriendly).length
    return { week: weekLabel(w), count: lost, ranked: inWeek.length }
  })
  const signInsByWeek = bucket(signIns, s => s.createdAt)
  const activeByWeek = weeks.map((w, i) => ({
    week: weekLabel(w),
    count: new Set(activeDays.filter(a => weekIndex(a.day) === i).map(a => a.userId)).size,
  }))
  // The tracking tables started with this feature; earlier weeks are unknown, not zero.
  const firstTracked = [...activeDays.map(a => a.day), ...signIns.map(s => s.createdAt)].reduce<Date | null>((min, d) => (!min || d < min ? d : min), null)
  const trackedFrom = firstTracked ? weekIndex(firstTracked) : WEEKS
  for (const series of [activeByWeek, signInsByWeek]) {
    series.forEach((p, i) => { (p as Record<string, unknown>).count = i < trackedFrom ? null : (p as Record<string, unknown>).count ?? 0 })
  }

  // --- Venues ---------------------------------------------------------------
  const venues = new Map<string, { venue: string; listed: boolean; matches: number; lastPlayed: Date }>()
  for (const m of matches) {
    const label = m.club ? `${m.club.name}, ${m.club.area}` : m.location?.trim()
    if (!label) continue
    const key = m.club ? `club:${label}` : `text:${label.toLowerCase().replace(/\s+/g, ' ')}`
    const v = venues.get(key) ?? { venue: label, listed: !!m.club, matches: 0, lastPlayed: m.playedAt }
    v.matches++
    if (m.playedAt > v.lastPlayed) v.lastPlayed = m.playedAt
    venues.set(key, v)
  }
  const venueRows = Array.from(venues.values()).sort((a, b) => b.matches - a.matches || b.lastPlayed.getTime() - a.lastPlayed.getTime())
  const noVenue = matches.filter(m => !m.club && !m.location?.trim()).length

  // --- Circles (same rule as getCircleIds: confirmed ranked matches) --------
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
  const median = sizes.length ? (sizes[Math.floor((sizes.length - 1) / 2)] + sizes[Math.ceil((sizes.length - 1) / 2)]) / 2 : 0
  const mean = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0

  // --- Average rating of all registered players, week by week ---------------
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
    const list = byPlayer.get(p.id) ?? []
    const first = history.find(h => h.playerId === p.id)
    return { joined, points: [{ at: joined, ptr: first?.ptrBefore ?? p.ptr }, ...list] }
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
  const ratingByWeek = weeks.map(w => ({ week: weekLabel(w), level: averageAt(Math.min(w.getTime() + 7 * DAY - 1, now.getTime())) }))
  const ratingNow = averageAt(now.getTime())
  const ratingThen = ratingByWeek.find(p => p.level !== null)?.level ?? null

  return {
    tiles: {
      registered: registered.length,
      newThisWeek: users.filter(u => u.createdAt >= thisWeek).length,
      active7d: activeSince(7),
      active30d: activeSince(30),
      guests: guests.length,
      claimed: claimed.length,
      matches: matches.length,
      matches7d: matches.filter(m => m.submittedAt.getTime() >= now.getTime() - 7 * DAY).length,
      errors7d,
    },
    signupsByWeek,
    matchesByWeek,
    activeByWeek,
    signInsByWeek,
    converted: { byWeek: convertedByWeek, total: converted.length, rankedTotal: rankedRecorded.length, stillPending },
    venues: venueRows.map(v => ({ ...v, lastPlayed: v.lastPlayed.toISOString().slice(0, 10) })),
    noVenue,
    circles: { histogram: circleHistogram, median, mean: Number(mean.toFixed(1)), players: sizes.length },
    rating: { byWeek: ratingByWeek, now: ratingNow, then: ratingThen },
    errors: errors.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })),
  }
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>
