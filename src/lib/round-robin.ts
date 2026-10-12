// Fixed-team Round Robin scheduling for 3 or more teams, on 1–6 courts or as
// a self-arranged league.
// Unlike Americano, partners never change — each team plays every other
// team exactly once. Matches are first-to-N games (not best-of), so a
// completed match has one team's score equal to the target and the other
// strictly below it.

// At least 3 teams. 15 is an operational cap (105 matches on one court) that
// isn't shown to players — the setup screen simply stops adding teams there.
export const ROUND_ROBIN_MIN_TEAMS = 3
export const ROUND_ROBIN_MAX_TEAMS = 15

// Every team plays every other team once.
export const roundRobinMatchCount = (teams: number) => (teams * (teams - 1)) / 2

export const ROUND_ROBIN_MAX_COURTS = 6
// More courts than half the teams can never all be in use at once.
export const usableCourts = (teams: number, courts: number) => Math.max(1, Math.min(courts, Math.floor(teams / 2)))

export interface RoundRobinFixture {
  round: number
  court: number | null
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

// Circle method with a bye slot for odd team counts: pads to an even
// number, runs the standard round-robin rotation, and drops any pairing
// that involves the bye. Produces exactly C(teamCount, 2) matches, each
// team facing every other team once.
function circleMethodTeamOrder(teamCount: number): [number, number][] {
  const BYE = -1
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1
  const ids = Array.from({ length: n }, (_, i) => (i < teamCount ? i : BYE))
  const fixed = ids[0]
  let rotating = ids.slice(1)
  const pairs: [number, number][] = []

  for (let r = 0; r < n - 1; r++) {
    const arranged = [fixed, ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = arranged[i]
      const b = arranged[n - 1 - i]
      if (a !== BYE && b !== BYE) pairs.push([a, b])
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)]
  }

  return pairs
}

// `teams` is an array of [player1Id, player2Id] pairs, one per team.
// Partners within a team are fixed for the whole event.
//
// Scheduled: matches are packed into rounds of up to `courts` at once — each
// round takes the earliest unplayed fixtures (in circle-method order) whose
// teams aren't already on court that round. On 1 court this is one match per
// round, in circle order. League (`league`): the same fixtures in circle
// order, with no rounds or courts — players arrange them themselves.
export function generateRoundRobinSchedule(teams: [string, string][], courts = 1, league = false): RoundRobinFixture[] {
  const teamCount = teams.length
  if (teamCount < ROUND_ROBIN_MIN_TEAMS || teamCount > ROUND_ROBIN_MAX_TEAMS) {
    throw new Error(`Round Robin needs ${ROUND_ROBIN_MIN_TEAMS} to ${ROUND_ROBIN_MAX_TEAMS} teams`)
  }
  const fixture = ([a, b]: [number, number], round: number, court: number | null): RoundRobinFixture => ({
    round,
    court,
    teamAPlayer1Id: teams[a][0],
    teamAPlayer2Id: teams[a][1],
    teamBPlayer1Id: teams[b][0],
    teamBPlayer2Id: teams[b][1],
  })

  const order = circleMethodTeamOrder(teamCount)
  // League rounds are the circle method's own: each team plays once per round
  // (one sits out when the count is odd). Players can still play them in any order.
  if (league) {
    const perRound = Math.floor(teamCount / 2)
    return order.map((pair, i) => fixture(pair, Math.floor(i / perRound) + 1, null))
  }

  const perRound = usableCourts(teamCount, courts)
  const remaining = [...order]
  const out: RoundRobinFixture[] = []
  for (let round = 1; remaining.length > 0; round++) {
    const busy = new Set<number>()
    let court = 0
    for (let i = 0; i < remaining.length && court < perRound; ) {
      const [a, b] = remaining[i]
      if (busy.has(a) || busy.has(b)) { i++; continue }
      busy.add(a)
      busy.add(b)
      out.push(fixture([a, b], round, ++court))
      remaining.splice(i, 1)
    }
  }
  return out
}

// --- League scoring ---------------------------------------------------------

export const LEAGUE_SCORING = {
  games: 'First to 4 games',
  set: 'First to a set',
  match: 'Full match',
} as const
export type LeagueScoring = keyof typeof LEAGUE_SCORING
export const LEAGUE_GAMES_TARGET = 4

export type SetScore = { a: number; b: number }

// A set to 6, won by 2, with a tie-break at 6–6: 6–0 … 6–4, 7–5 or 7–6.
function setWinner({ a, b }: SetScore): 'A' | 'B' | null {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  const valid = (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))
  return valid ? (a > b ? 'A' : 'B') : null
}

// Checks a league result and works out the winner and the scores kept on the
// match: games for a race or a single set, sets won for a full match.
export function scoreLeagueResult(
  scoring: LeagueScoring,
  sets: unknown
): { error: string } | { winner: 'A' | 'B'; teamAScore: number; teamBScore: number; sets: SetScore[] } {
  if (!Array.isArray(sets) || sets.some(s => !s || !Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0)) {
    return { error: 'Enter the games for each set' }
  }
  const list = sets as SetScore[]

  if (scoring === 'games') {
    const [s] = list
    if (list.length !== 1 || Math.max(s.a, s.b) !== LEAGUE_GAMES_TARGET || Math.min(s.a, s.b) >= LEAGUE_GAMES_TARGET) {
      return { error: `First to ${LEAGUE_GAMES_TARGET} — the winner has ${LEAGUE_GAMES_TARGET} games, the other fewer` }
    }
    return { winner: s.a > s.b ? 'A' : 'B', teamAScore: s.a, teamBScore: s.b, sets: list }
  }

  if (scoring === 'set') {
    const winner = list.length === 1 ? setWinner(list[0]) : null
    if (!winner) return { error: 'A set ends 6–0 to 6–4, 7–5 or 7–6' }
    return { winner, teamAScore: list[0].a, teamBScore: list[0].b, sets: list }
  }

  // Best of 3: stops as soon as one pair has two sets.
  if (list.length < 2 || list.length > 3) return { error: 'A full match is 2 or 3 sets' }
  let setsA = 0
  let setsB = 0
  for (let i = 0; i < list.length; i++) {
    if (setsA === 2 || setsB === 2) return { error: 'The match was already won — remove the extra set' }
    const w = setWinner(list[i])
    if (!w) return { error: `Set ${i + 1}: a set ends 6–0 to 6–4, 7–5 or 7–6` }
    if (w === 'A') setsA++
    else setsB++
  }
  if (setsA < 2 && setsB < 2) return { error: 'Nobody has won two sets yet — add the deciding set' }
  return { winner: setsA > setsB ? 'A' : 'B', teamAScore: setsA, teamBScore: setsB, sets: list }
}

// League table: wins first, then game difference, then games won. Only
// confirmed results count.
export type LeagueRow = { teamIndex: number; playerIds: [string, string]; played: number; won: number; lost: number; gamesFor: number; gamesAgainst: number }

export function leagueStandings(
  teams: [string, string][],
  matches: { status: string; teamAPlayer1Id: string; teamBPlayer1Id: string; teamAScore: number | null; teamBScore: number | null; sets: SetScore[] | null }[]
): LeagueRow[] {
  const rows = teams.map((playerIds, teamIndex) => ({ teamIndex, playerIds, played: 0, won: 0, lost: 0, gamesFor: 0, gamesAgainst: 0 }))
  const byPlayer = new Map(teams.map((t, i) => [t[0], rows[i]]))
  for (const m of matches) {
    if (m.status !== 'complete' || m.teamAScore === null || m.teamBScore === null) continue
    const a = byPlayer.get(m.teamAPlayer1Id)
    const b = byPlayer.get(m.teamBPlayer1Id)
    if (!a || !b) continue
    const sets = m.sets ?? [{ a: m.teamAScore, b: m.teamBScore }]
    const ga = sets.reduce((n, s) => n + s.a, 0)
    const gb = sets.reduce((n, s) => n + s.b, 0)
    const aWon = m.teamAScore > m.teamBScore
    a.played++; b.played++
    if (aWon) { a.won++; b.lost++ } else { b.won++; a.lost++ }
    a.gamesFor += ga; a.gamesAgainst += gb
    b.gamesFor += gb; b.gamesAgainst += ga
  }
  return rows.sort((x, y) => y.won - x.won || (y.gamesFor - y.gamesAgainst) - (x.gamesFor - x.gamesAgainst) || y.gamesFor - x.gamesFor)
}

const sideOf = (m: { teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }, playerId: string | null) =>
  !playerId ? null : [m.teamAPlayer1Id, m.teamAPlayer2Id].includes(playerId) ? 'A' : [m.teamBPlayer1Id, m.teamBPlayer2Id].includes(playerId) ? 'B' : null

// Who may do what with a league match, for the screen and the server alike.
export function leagueMatchActions(m: { status: string; submittedById: string | null; teamAPlayer1Id: string; teamAPlayer2Id: string; teamBPlayer1Id: string; teamBPlayer2Id: string }, playerId: string) {
  const mine = sideOf(m, playerId)
  const submitter = sideOf(m, m.submittedById)
  return {
    canSubmit: !!mine && m.status === 'pending',
    canConfirm: !!mine && m.status === 'submitted' && submitter !== mine,
    // The other pair rejects; the pair that entered it can withdraw it.
    canClear: !!mine && m.status === 'submitted',
  }
}

// --- One-off event scoring -------------------------------------------------
// games: a race to 4, 6 or 8 games. points: every match is played to an odd
// total of points (3–33), so it can't tie; the leaderboard adds up points won.
export type OneOffScoring = 'games' | 'points'
export const GAMES_TARGETS = [4, 6, 8] as const
export const POINTS_TOTALS = Array.from({ length: 16 }, (_, i) => 3 + i * 2) // 3, 5, … 33
export const DEFAULT_POINTS = 21

export function oneOffTargetValid(scoring: OneOffScoring, target: number): boolean {
  return scoring === 'points' ? POINTS_TOTALS.includes(target) : (GAMES_TARGETS as readonly number[]).includes(target)
}

// Null when the score is valid, otherwise what's wrong with it.
export function checkOneOffScore(scoring: OneOffScoring, target: number, a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return 'Scores must be whole numbers, 0 or more'
  if (scoring === 'points') {
    return a + b === target ? null : `${target} points per match — the two scores must add up to ${target}`
  }
  if (a === b || Math.max(a, b) !== target || Math.min(a, b) >= target) {
    return `First to ${target} — the winner's score is ${target}, the other lower`
  }
  return null
}
