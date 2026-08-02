// Snake and Ladders: 8 players, 2 matches per round (top court / bottom
// court). Round 1 is seeded by PTR; every round after that reshuffles
// winners into the next top-court match and losers into the next
// bottom-court match, so round-1 fixtures are the only ones known in
// advance — later rounds are generated on demand once the prior round's
// both matches are complete (see snake-ladders-store.ts).

export interface SnakeLaddersFixture {
  round: number
  court: 'top' | 'bottom'
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

type Pair = [string, string]

// Top 4 by current PTR seed the top-court match (1&4 vs 2&3); bottom 4
// seed the bottom-court match (5&8 vs 6&7) — strongest paired with
// weakest within each group of 4.
export function seedRound1(playerIdsByPtrDesc: string[]): SnakeLaddersFixture[] {
  if (playerIdsByPtrDesc.length !== 8) throw new Error('Snake and Ladders requires exactly 8 players')
  const [r1, r2, r3, r4, r5, r6, r7, r8] = playerIdsByPtrDesc
  return [
    { round: 1, court: 'top', teamAPlayer1Id: r1, teamAPlayer2Id: r4, teamBPlayer1Id: r2, teamBPlayer2Id: r3 },
    { round: 1, court: 'bottom', teamAPlayer1Id: r5, teamAPlayer2Id: r8, teamBPlayer1Id: r6, teamBPlayer2Id: r7 },
  ]
}

// Splits two just-played pairs into two new pairs, guaranteeing neither
// new pair reunites a partnership that just played together — the only
// two ways to combine two pairs of 2 without that are {a0-b0, a1-b1} or
// {a0-b1, a1-b0}, picked at random. Used both for the winners moving into
// the next top-court match and the losers moving into the next
// bottom-court match, so every player's round-N partner becomes a
// round-N+1 opponent.
function splitReshuffle(pairA: Pair, pairB: Pair): [Pair, Pair] {
  if (Math.random() < 0.5) return [[pairA[0], pairB[0]], [pairA[1], pairB[1]]]
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

// Builds the next round's top/bottom matches from the just-completed
// round: the two winning pairs are split-reshuffled into the next
// top-court match, the two losing pairs are split-reshuffled into the
// next bottom-court match. Pairs "climb" toward the top court by winning
// and "slide" toward the bottom court by losing.
export function nextRoundFixtures(
  round: number,
  topMatch: CompletedMatch,
  bottomMatch: CompletedMatch
): SnakeLaddersFixture[] {
  const [wTop, wBottom] = splitReshuffle(winnerPair(topMatch), winnerPair(bottomMatch))
  const [lTop, lBottom] = splitReshuffle(loserPair(topMatch), loserPair(bottomMatch))

  return [
    {
      round,
      court: 'top',
      teamAPlayer1Id: wTop[0], teamAPlayer2Id: wTop[1],
      teamBPlayer1Id: wBottom[0], teamBPlayer2Id: wBottom[1],
    },
    {
      round,
      court: 'bottom',
      teamAPlayer1Id: lTop[0], teamAPlayer2Id: lTop[1],
      teamBPlayer1Id: lBottom[0], teamBPlayer2Id: lBottom[1],
    },
  ]
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

// Final round placement, once both its matches are complete: top match
// winner = 1st, top match loser = 2nd, bottom match winner = 3rd, bottom
// match loser = 4th. Returns null until then. Shared by the store's
// finalize/list functions and the event-view UI.
export function finalPlacements(matches: PlacementMatch[], totalRounds: number): [Pair, Pair, Pair, Pair] | null {
  const top = matches.find(m => m.round === totalRounds && m.court === 'top')
  const bottom = matches.find(m => m.round === totalRounds && m.court === 'bottom')
  if (!top || !bottom || top.status !== 'complete' || bottom.status !== 'complete') return null
  if (top.teamAScore === null || top.teamBScore === null || bottom.teamAScore === null || bottom.teamBScore === null) return null

  const t = { ...top, teamAScore: top.teamAScore, teamBScore: top.teamBScore }
  const b = { ...bottom, teamAScore: bottom.teamAScore, teamBScore: bottom.teamBScore }

  return [winnerPair(t), loserPair(t), winnerPair(b), loserPair(b)]
}
