// Individual Americano scheduling: 4–24 players (not 7, 11, 15, 19 or 23) on
// 1–6 courts. Partners rotate every round. Goal: every player partners every
// other player exactly once where the count allows it (one partnership repeats
// when it doesn't), with play time and opponents balanced.

export interface AmericanoFixture {
  round: number
  court: number
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

type Pair = [string, string]
type Match = [Pair, Pair]

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

// Player counts offered. Counts of the form 4k+3 are left out by choice.
export const AMERICANO_SIZES = [4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24]
export const AMERICANO_MAX_COURTS = 6
// Each court takes 4 players.
export const americanoMaxCourts = (players: number) => Math.max(1, Math.min(AMERICANO_MAX_COURTS, Math.floor(players / 4)))

// Circle method: for an even count, n - 1 "sessions", each pairing everyone
// off, so every pair of players is together in exactly one session.
function circleMethodPartnerSessions(playerIds: string[]): Pair[][] {
  const n = playerIds.length
  const fixed = playerIds[0]
  let rotating = playerIds.slice(1)
  const sessions: Pair[][] = []

  for (let r = 0; r < n - 1; r++) {
    const arranged = [fixed, ...rotating]
    const pairs: Pair[] = []
    for (let i = 0; i < n / 2; i++) {
      pairs.push([arranged[i], arranged[n - 1 - i]])
    }
    sessions.push(pairs)
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)]
  }

  return sessions
}

const BYE = '__bye__'

// Every partnership in sessions, then each session's pairs matched up into
// games (pair vs pair), choosing opponents seen least so far.
//  · 4k players: each session splits into k games — exact.
//  · 4k+1: a "bye" makes the count even; whoever is paired with it sits out
//    that session, the rest split into k games — still exact.
//  · 4k+2: sessions have an odd number of pairs, so one pair per session is
//    held back and played against the next session's held-back pair. One
//    pair is left at the very end and plays a pair that repeats a partnership.
function partnerMatches(playerIds: string[]): Match[] {
  const n = playerIds.length
  const opponents = new Map<string, number>()
  const oppCost = (a: Pair, b: Pair) => a.reduce((s, x) => s + b.reduce((t, y) => t + (opponents.get(key(x, y)) ?? 0), 0), 0)
  const plays = new Map<string, number>(playerIds.map(id => [id, 0]))
  const matches: Match[] = []
  const play = (a: Pair, b: Pair) => {
    matches.push([a, b])
    for (const x of a) for (const y of b) opponents.set(key(x, y), (opponents.get(key(x, y)) ?? 0) + 1)
    for (const id of [...a, ...b]) plays.set(id, (plays.get(id) ?? 0) + 1)
  }
  // Split an even number of pairs into games, least-seen opponents first.
  const split = (pairs: Pair[]) => {
    const left = [...pairs]
    while (left.length >= 2) {
      let best: [number, number] = [0, 1]
      let bestCost = Infinity
      for (let i = 0; i < left.length; i++) {
        for (let j = i + 1; j < left.length; j++) {
          const c = oppCost(left[i], left[j])
          if (c < bestCost) { bestCost = c; best = [i, j] }
        }
      }
      const [a, b] = [left[best[0]], left[best[1]]]
      play(a, b)
      left.splice(best[1], 1)
      left.splice(best[0], 1)
    }
  }
  const disjoint = (a: Pair, b: Pair) => !a.includes(b[0]) && !a.includes(b[1])

  const sessions = circleMethodPartnerSessions(n % 2 === 0 ? playerIds : [...playerIds, BYE])
    .map(pairs => pairs.filter(p => !p.includes(BYE)))

  let heldBack: Pair | null = null
  for (const pairs of sessions) {
    if (pairs.length % 2 === 0) { split(pairs); continue }
    // Odd number of pairs (4k+2 players): hold one back. If one is already
    // waiting, hold back a pair it can play, and play them together.
    const waiting: Pair | null = heldBack
    const candidates = waiting ? pairs.filter(p => disjoint(p, waiting)) : pairs
    const pick: Pair = waiting ? candidates.reduce((b, p) => (oppCost(p, waiting) < oppCost(b, waiting) ? p : b)) : candidates[candidates.length - 1]
    split(pairs.filter(p => p !== pick))
    if (waiting) { play(waiting, pick); heldBack = null } else heldBack = pick
  }
  if (heldBack) {
    // The last held-back pair needs opponents: two other players who've played
    // least, as a repeat partnership. Their extra game is left out of their
    // points (see computeExcludedRounds).
    const last: Pair = heldBack
    const others = playerIds.filter(id => !last.includes(id)).sort((a, b) => (plays.get(a) ?? 0) - (plays.get(b) ?? 0))
    play(last, [others[0], others[1]])
  }
  return matches
}

// Fills rounds with up to `courts` games whose players don't overlap, taking
// games in order so sitting out stays spread evenly.
function packIntoRounds(matches: Match[], courts: number): AmericanoFixture[] {
  const queue = [...matches]
  const out: AmericanoFixture[] = []
  for (let round = 1; queue.length > 0; round++) {
    const busy = new Set<string>()
    let court = 0
    for (let i = 0; i < queue.length && court < courts; ) {
      const [a, b] = queue[i]
      if ([...a, ...b].some(id => busy.has(id))) { i++; continue }
      for (const id of [...a, ...b]) busy.add(id)
      out.push({ round, court: ++court, teamAPlayer1Id: a[0], teamAPlayer2Id: a[1], teamBPlayer1Id: b[0], teamBPlayer2Id: b[1] })
      queue.splice(i, 1)
    }
  }
  return out
}

// Fisher-Yates shuffle. Both scheduling methods are entirely deterministic
// given player order, so without this the same roster would produce the
// identical round-by-round schedule every time an event is started —
// shuffling the input order first gives a different (still fully valid)
// schedule each time.
function shuffled(ids: string[]): string[] {
  const arr = [...ids]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateAmericanoSchedule(playerIds: string[], courts = 1): AmericanoFixture[] {
  if (!AMERICANO_SIZES.includes(playerIds.length)) {
    throw new Error(`Americano needs ${AMERICANO_SIZES.join(', ')} players`)
  }
  const matches = partnerMatches(shuffled(playerIds))
  return packIntoRounds(matches, Math.min(courts, americanoMaxCourts(playerIds.length)))
}

// For players who get one extra match (4k+2 players: the repeat partnership
// at the end), returns the round that should NOT count toward that player's
// leaderboard total — their last appearance, which is that extra game.
// Players with no extra match have no entry (nothing excluded for them).
export function computeExcludedRounds<
  M extends { round: number; teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }
>(matches: M[], playerIds: string[]): Map<string, number> {
  const playCount = new Map<string, number>(playerIds.map(id => [id, 0]))
  const lastRound = new Map<string, number>()

  for (const m of matches) {
    for (const pid of [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]) {
      playCount.set(pid, (playCount.get(pid) ?? 0) + 1)
      if (m.round > (lastRound.get(pid) ?? 0)) lastRound.set(pid, m.round)
    }
  }

  const minPlays = Math.min(...Array.from(playCount.values()))
  const excluded = new Map<string, number>()
  for (const id of playerIds) {
    if ((playCount.get(id) ?? 0) > minPlays) excluded.set(id, lastRound.get(id)!)
  }
  return excluded
}

// Leaderboard points per player: sum of the team score for every completed
// match they played, except their own excluded round (see
// computeExcludedRounds). Shared by the leaderboard display, event lists,
// and the PTR calculation so all three always agree on the same numbers.
export function computeLeaderboardPoints<
  M extends {
    round: number
    status: string
    teamAScore: number | null
    teamBScore: number | null
    teamAPlayer1Id: string
    teamAPlayer2Id: string
    teamBPlayer1Id: string
    teamBPlayer2Id: string
  }
>(matches: M[], playerIds: string[]): Map<string, number> {
  const excludedRounds = computeExcludedRounds(matches, playerIds)
  const points = new Map<string, number>(playerIds.map(id => [id, 0]))

  for (const m of matches) {
    if (m.status !== 'complete' || m.teamAScore === null || m.teamBScore === null) continue
    if (excludedRounds.get(m.teamAPlayer1Id) !== m.round) points.set(m.teamAPlayer1Id, (points.get(m.teamAPlayer1Id) ?? 0) + m.teamAScore)
    if (excludedRounds.get(m.teamAPlayer2Id) !== m.round) points.set(m.teamAPlayer2Id, (points.get(m.teamAPlayer2Id) ?? 0) + m.teamAScore)
    if (excludedRounds.get(m.teamBPlayer1Id) !== m.round) points.set(m.teamBPlayer1Id, (points.get(m.teamBPlayer1Id) ?? 0) + m.teamBScore)
    if (excludedRounds.get(m.teamBPlayer2Id) !== m.round) points.set(m.teamBPlayer2Id, (points.get(m.teamBPlayer2Id) ?? 0) + m.teamBScore)
  }

  return points
}
