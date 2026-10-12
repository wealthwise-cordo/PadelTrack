// Snake and Ladders: 1–4 courts with 4 players each (4, 8, 12 or 16), one
// match per court each round. Court 1 is the top court. Round 1 is seeded by
// rating; after each round, winners climb a court and losers slide down one
// (top-court winners stay top, bottom-court losers stay bottom), with partners
// reshuffled. So only round 1 is known in advance — later rounds are made
// once every court has finished (see snake-ladders-store.ts).
//
// Courts are stored as "1", "2", … Events from before multiple courts used
// "top" and "bottom" for courts 1 and 2.

export const SNAKE_LADDERS_MAX_COURTS = 4
export const snakeLaddersPlayers = (courts: number) => courts * 4

export function courtNumber(court: string): number {
  return court === 'top' ? 1 : court === 'bottom' ? 2 : Number(court)
}

export interface SnakeLaddersFixture {
  round: number
  court: string
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

type Pair = [string, string]

// Seeded in groups of 4 by rating: the top 4 on court 1 (1&4 vs 2&3), the
// next 4 on court 2 (5&8 vs 6&7), and so on — strongest with weakest in each.
export function seedRound1(playerIdsByPtrDesc: string[], courts: number): SnakeLaddersFixture[] {
  if (playerIdsByPtrDesc.length !== snakeLaddersPlayers(courts)) {
    throw new Error(`Snake and Ladders on ${courts} court${courts > 1 ? 's' : ''} needs exactly ${snakeLaddersPlayers(courts)} players`)
  }
  return Array.from({ length: courts }, (_, c) => {
    const [a, b, d, e] = playerIdsByPtrDesc.slice(c * 4, c * 4 + 4)
    return { round: 1, court: String(c + 1), teamAPlayer1Id: a, teamAPlayer2Id: e, teamBPlayer1Id: b, teamBPlayer2Id: d }
  })
}

// Splits two just-played pairs into two new pairs so neither new pair
// reunites partners who just played together — the only two ways are
// {a0-b0, a1-b1} or {a0-b1, a1-b0}. Every player's partner this round becomes
// an opponent next round. Which way is decided by round and court rather than
// at random, so if two courts finish at the same moment and both build the
// next round, they build the same one.
function splitReshuffle(pairA: Pair, pairB: Pair, flip: boolean): [Pair, Pair] {
  if (flip) return [[pairA[0], pairB[0]], [pairA[1], pairB[1]]]
  return [[pairA[0], pairB[1]], [pairA[1], pairB[0]]]
}

interface CompletedMatch {
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAScore: number
  teamBScore: number
}

function winnerPair(m: CompletedMatch): Pair {
  return m.teamAScore > m.teamBScore ? [m.teamAPlayer1Id, m.teamAPlayer2Id] : [m.teamBPlayer1Id, m.teamBPlayer2Id]
}

function loserPair(m: CompletedMatch): Pair {
  return m.teamAScore > m.teamBScore ? [m.teamBPlayer1Id, m.teamBPlayer2Id] : [m.teamAPlayer1Id, m.teamAPlayer2Id]
}

// Builds the next round from the finished one (matches in court order, top
// first). Each court gets two pairs, reshuffled so nobody keeps a partner:
//  · court 1: its own winners + the winners from court 2
//  · a middle court: losers from the court above + winners from the court below
//  · the bottom court: losers from the court above + its own losers
// On a single court the winners and losers simply swap partners.
export function nextRoundFixtures(round: number, byCourt: CompletedMatch[]): SnakeLaddersFixture[] {
  const n = byCourt.length
  const w = byCourt.map(winnerPair)
  const l = byCourt.map(loserPair)
  return byCourt.map((_, c) => {
    const [x, y] =
      n === 1 ? [w[0], l[0]]
      : c === 0 ? [w[0], w[1]]
      : c === n - 1 ? [l[c - 1], l[c]]
      : [l[c - 1], w[c + 1]]
    const [teamA, teamB] = splitReshuffle(x, y, (round + c) % 2 === 0)
    return { round, court: String(c + 1), teamAPlayer1Id: teamA[0], teamAPlayer2Id: teamA[1], teamBPlayer1Id: teamB[0], teamBPlayer2Id: teamB[1] }
  })
}

interface PlacementMatch {
  round: number
  court: string
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAScore: number | null
  teamBScore: number | null
  status: string
}

// Final placings once every court in the last round is done: court 1's
// winners are 1st and losers 2nd, court 2's winners 3rd and losers 4th, and
// so on. Null until then. Shared by the store and the event screen.
export function finalPlacements(matches: PlacementMatch[], totalRounds: number, courts: number): Pair[] | null {
  const last = matches.filter(m => m.round === totalRounds).sort((a, b) => courtNumber(a.court) - courtNumber(b.court))
  if (last.length !== courts || last.some(m => m.status !== 'complete' || m.teamAScore === null || m.teamBScore === null)) return null
  return last.flatMap(m => {
    const done = { ...m, teamAScore: m.teamAScore!, teamBScore: m.teamBScore! }
    return [winnerPair(done), loserPair(done)]
  })
}
