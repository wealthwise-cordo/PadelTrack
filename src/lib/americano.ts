// Individual Americano scheduling for 4, 5, 7, or 8 players on 1 court.
// Goal: every player partners with every other player at least once
// (exactly once where the player count allows it), with play time and
// opponent exposure balanced as evenly as possible.

export interface AmericanoFixture {
  round: number
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

type Pair = [string, string]

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

// Circle method: produces playerIds.length - 1 "sessions", each a perfect
// matching (pairs covering every player exactly once). Across all sessions,
// every unordered pair of players occurs together exactly once. Only valid
// when playerIds.length is even.
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

// 4 or 8 players: each circle-method session either *is* one match (4
// players, 2 pairs) or splits cleanly into two matches (8 players, 4 pairs).
// Both cases are a proven-exact decomposition — every partnership occurs
// exactly once across the whole schedule.
function evenPlayerSchedule(playerIds: string[]): AmericanoFixture[] {
  const sessions = circleMethodPartnerSessions(playerIds)
  const opponentCount = new Map<string, number>()
  const oppCost = (pairA: Pair, pairB: Pair) =>
    pairA.reduce((sum, a) => sum + pairB.reduce((s, b) => s + (opponentCount.get(key(a, b)) ?? 0), 0), 0)
  const recordOpponents = (pairA: Pair, pairB: Pair) => {
    for (const a of pairA) for (const b of pairB) opponentCount.set(key(a, b), (opponentCount.get(key(a, b)) ?? 0) + 1)
  }

  const fixtures: AmericanoFixture[] = []
  let round = 1

  const addMatch = (teamA: Pair, teamB: Pair) => {
    fixtures.push({
      round: round++,
      teamAPlayer1Id: teamA[0],
      teamAPlayer2Id: teamA[1],
      teamBPlayer1Id: teamB[0],
      teamBPlayer2Id: teamB[1],
    })
    recordOpponents(teamA, teamB)
  }

  for (const pairs of sessions) {
    if (pairs.length === 2) {
      // 4 players: the session's 2 pairs are the only possible match.
      addMatch(pairs[0], pairs[1])
    } else {
      // 8 players: 3 ways to split 4 partner-pairs into two matches; pick
      // whichever split has been seen least as opponents so far.
      const [p0, p1, p2, p3] = pairs
      const candidates: { match1: [Pair, Pair]; match2: [Pair, Pair]; cost: number }[] = [
        { match1: [p0, p1], match2: [p2, p3], cost: oppCost(p0, p1) + oppCost(p2, p3) },
        { match1: [p0, p2], match2: [p1, p3], cost: oppCost(p0, p2) + oppCost(p1, p3) },
        { match1: [p0, p3], match2: [p1, p2], cost: oppCost(p0, p3) + oppCost(p1, p2) },
      ]
      candidates.sort((a, b) => a.cost - b.cost)
      const best = candidates[0]
      addMatch(best.match1[0], best.match1[1])
      addMatch(best.match2[0], best.match2[1])
    }
  }

  return fixtures
}

// 5 or 7 players, 1 court: 4 play each round, the rest sit out. When N isn't
// a multiple of 4, C(N,2) partner pairs can't always be split evenly across
// 2-pairs-per-round matches — for N=5 it works out exactly (10 pairs, 5
// rounds), for N=7 one pair is unavoidably repeated (21 pairs is odd).
// Greedily builds rounds from the 4-player subset (and pairing within it)
// that best balances fresh partnerships, play-time, and opponent exposure.
function unevenPlayerSchedule(playerIds: string[]): AmericanoFixture[] {
  const n = playerIds.length
  const allPairs: Pair[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) allPairs.push([playerIds[i], playerIds[j]])
  }

  const unused = new Set(allPairs.map(p => key(p[0], p[1])))
  const playCount = new Map<string, number>(playerIds.map(id => [id, 0]))
  const opponentCount = new Map<string, number>()

  const subsets: number[][] = []
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) subsets.push([a, b, c, d])
      }
    }
  }

  const fixtures: AmericanoFixture[] = []
  let round = 1

  while (unused.size > 0) {
    let best: { teamA: Pair; teamB: Pair; score: number } | null = null

    for (const [i, j, k, l] of subsets) {
      const ids = [playerIds[i], playerIds[j], playerIds[k], playerIds[l]]
      const pairings: [Pair, Pair][] = [
        [[ids[0], ids[1]], [ids[2], ids[3]]],
        [[ids[0], ids[2]], [ids[1], ids[3]]],
        [[ids[0], ids[3]], [ids[1], ids[2]]],
      ]
      for (const [teamA, teamB] of pairings) {
        const freshPenalty = (unused.has(key(teamA[0], teamA[1])) ? 0 : 5) + (unused.has(key(teamB[0], teamB[1])) ? 0 : 5)
        const playPenalty = ids.reduce((s, id) => s + (playCount.get(id) ?? 0), 0)
        const oppPenalty = teamA.reduce(
          (s, a) => s + teamB.reduce((s2, b) => s2 + (opponentCount.get(key(a, b)) ?? 0), 0),
          0
        )
        const score = freshPenalty * 100 + playPenalty * 10 + oppPenalty
        if (!best || score < best.score) best = { teamA, teamB, score }
      }
    }

    if (!best) break
    const { teamA, teamB } = best
    fixtures.push({
      round: round++,
      teamAPlayer1Id: teamA[0],
      teamAPlayer2Id: teamA[1],
      teamBPlayer1Id: teamB[0],
      teamBPlayer2Id: teamB[1],
    })
    unused.delete(key(teamA[0], teamA[1]))
    unused.delete(key(teamB[0], teamB[1]))
    for (const id of [...teamA, ...teamB]) playCount.set(id, (playCount.get(id) ?? 0) + 1)
    for (const a of teamA) for (const b of teamB) opponentCount.set(key(a, b), (opponentCount.get(key(a, b)) ?? 0) + 1)
  }

  return fixtures
}

// When the player count doesn't divide evenly into rounds of 4, a few
// players end up with one extra match (e.g. 7 players: 2 of them play 7
// rounds, the other 5 play 6). To keep the leaderboard fair, that extra
// match is excluded from those players' point totals — so this pushes each
// such player's final (extra) appearance to the end of the schedule, and
// renumbers rounds so "last match" and "excluded match" line up.
function pushExtraMatchesToEnd(fixtures: AmericanoFixture[], playerIds: string[]): AmericanoFixture[] {
  const playCount = new Map<string, number>(playerIds.map(id => [id, 0]))
  for (const f of fixtures) {
    for (const pid of [f.teamAPlayer1Id, f.teamAPlayer2Id, f.teamBPlayer1Id, f.teamBPlayer2Id]) {
      playCount.set(pid, (playCount.get(pid) ?? 0) + 1)
    }
  }
  const minPlays = Math.min(...Array.from(playCount.values()))
  const extraPlayers = new Set(playerIds.filter(id => (playCount.get(id) ?? 0) > minPlays))
  if (extraPlayers.size === 0) return fixtures

  const lastRoundForExtra = new Map<string, number>()
  for (const f of fixtures) {
    for (const pid of [f.teamAPlayer1Id, f.teamAPlayer2Id, f.teamBPlayer1Id, f.teamBPlayer2Id]) {
      if (extraPlayers.has(pid)) lastRoundForExtra.set(pid, f.round)
    }
  }
  const deferredRounds = new Set(Array.from(lastRoundForExtra.values()))

  const normal = fixtures.filter(f => !deferredRounds.has(f.round))
  const deferred = fixtures.filter(f => deferredRounds.has(f.round)).sort((a, b) => a.round - b.round)

  return [...normal, ...deferred].map((f, i) => ({ ...f, round: i + 1 }))
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

export function generateAmericanoSchedule(playerIds: string[]): AmericanoFixture[] {
  const shuffledIds = shuffled(playerIds)

  let fixtures: AmericanoFixture[]
  if (shuffledIds.length === 4 || shuffledIds.length === 8) fixtures = evenPlayerSchedule(shuffledIds)
  else if (shuffledIds.length === 5 || shuffledIds.length === 7) fixtures = unevenPlayerSchedule(shuffledIds)
  else throw new Error('Americano scheduling supports 4, 5, 7, or 8 players')

  return pushExtraMatchesToEnd(fixtures, shuffledIds)
}

// For players who get one extra match (uneven player counts), returns the
// round number that should NOT count toward that player's leaderboard
// total — their final appearance, per pushExtraMatchesToEnd above. Players
// with an even number of matches have no entry (nothing excluded for them).
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
