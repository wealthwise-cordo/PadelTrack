import type { MatchSet, PTRCalculation } from '@/types'

const K_MAX = 50  // volatility for new players
const K_MIN = 20  // volatility for established players
const RELIABILITY_MATCHES = 15 // matches to reach full reliability
const ELO_DIVISOR = 400

export function calculateReliability(matchesPlayed: number): number {
  return Math.min(1.0, matchesPlayed / RELIABILITY_MATCHES)
}

export function calculateKFactor(reliability: number): number {
  return K_MAX * (1 - reliability) + K_MIN * reliability
}

export function calculateExpectedWin(avgPTRA: number, avgPTRB: number): number {
  return 1 / (1 + Math.pow(10, (avgPTRB - avgPTRA) / ELO_DIVISOR))
}

export function calculateScoreMultiplier(sets: MatchSet[], winner: 'A' | 'B'): number {
  let totalGamesWon = 0
  let totalGamesLost = 0

  for (const set of sets) {
    if (winner === 'A') {
      totalGamesWon += set.teamAGames
      totalGamesLost += set.teamBGames
    } else {
      totalGamesWon += set.teamBGames
      totalGamesLost += set.teamAGames
    }
  }

  const totalGames = totalGamesWon + totalGamesLost
  const maxPossible = sets.length * 12 // max ~6+6 per set

  // game differential as fraction of max possible
  const differential = (totalGamesWon - totalGamesLost) / Math.max(maxPossible, 1)

  // multiplier: 0.75 (very close) to 1.5 (dominant)
  const multiplier = 1 + differential * 0.5
  return Math.max(0.75, Math.min(1.5, multiplier))
}

export function calculateMatchQuality(
  avgPTRA: number,
  avgPTRB: number,
  sets: MatchSet[]
): number {
  const played = sets.filter(s => s.teamAGames + s.teamBGames > 0)

  // PTR balance: 0–3 pts (evenly matched teams)
  const ptrDiff = Math.abs(avgPTRA - avgPTRB)
  const ptrScore = Math.max(0, 3 - ptrDiff / 60)

  // Set score closeness: up to 2 pts per set played, capped at 4
  let setScore = 0
  for (const s of played) {
    const diff = Math.abs(s.teamAGames - s.teamBGames)
    setScore += Math.max(0, 2 - diff * 0.5)
  }
  setScore = Math.min(4, setScore)

  // 3rd-set bonus: only rewarded if the deciding set was actually close.
  // A one-sided 3rd set gets nothing, so a tight 2-setter can outscore it.
  // Max 3 pts (tiebreak decider) scaling to 0 pts at 4+ game margin.
  const went3Sets = played.length === 3
  const thirdSetBonus = went3Sets
    ? Math.max(0, 1 - Math.abs(played[2].teamAGames - played[2].teamBGames) / 4) * 3
    : 0

  return Math.min(10, Math.max(1, ptrScore + setScore + thirdSetBonus))
}

export function isUpset(
  avgPTRA: number,
  avgPTRB: number,
  winner: 'A' | 'B'
): boolean {
  const expectedA = calculateExpectedWin(avgPTRA, avgPTRB)
  if (winner === 'A') return expectedA < 0.4  // A was underdog
  return expectedA > 0.6  // B was underdog
}

// How much weight to give individual contribution vs flat team split.
// 0 = both teammates always get the same delta; 1 = fully individual.
const INDIVIDUAL_FACTOR = 0.5

/**
 * For each player on a team, compute their normalised weight in the
 * delta distribution based on their individual ELO expectation vs the
 * opposing team's average PTR.
 *
 * Winners: the player who was individually less expected to win gets more
 *          credit (they outperformed their expectation).
 * Losers:  the player who was individually more expected to win takes more
 *          of the penalty (they underperformed their expectation).
 *
 * Weights always sum to 1 so the team total is preserved.
 */
function individualWeights(
  ptrs: [number, number],
  opponentAvgPTR: number,
  isWinner: boolean
): [number, number] {
  const e0 = calculateExpectedWin(ptrs[0], opponentAvgPTR)
  const e1 = calculateExpectedWin(ptrs[1], opponentAvgPTR)
  const w0 = isWinner ? (1 - e0) : e0
  const w1 = isWinner ? (1 - e1) : e1
  const total = w0 + w1
  if (total === 0) return [0.5, 0.5]
  return [w0 / total, w1 / total]
}

export function calculatePTRChanges(
  playerAPTRs: [number, number],
  playerBPTRs: [number, number],
  playerAReliabilities: [number, number],
  playerBReliabilities: [number, number],
  sets: MatchSet[],
  winner: 'A' | 'B'
): {
  playerADeltas: [number, number]
  playerBDeltas: [number, number]
  teamADelta: number
  teamBDelta: number
  scoreMultiplier: number
  expectedWinA: number
  matchQuality: number
  isUpset: boolean
} {
  const avgPTRA = (playerAPTRs[0] + playerAPTRs[1]) / 2
  const avgPTRB = (playerBPTRs[0] + playerBPTRs[1]) / 2

  const avgRelA = (playerAReliabilities[0] + playerAReliabilities[1]) / 2
  const avgRelB = (playerBReliabilities[0] + playerBReliabilities[1]) / 2
  const avgRel = (avgRelA + avgRelB) / 2

  const K = calculateKFactor(avgRel)
  const expectedWinA = calculateExpectedWin(avgPTRA, avgPTRB)
  const scoreMultiplier = calculateScoreMultiplier(sets, winner)
  const matchQuality = calculateMatchQuality(avgPTRA, avgPTRB, sets)
  const upset = isUpset(avgPTRA, avgPTRB, winner)

  const actualA = winner === 'A' ? 1 : 0
  const rawDelta = K * scoreMultiplier * (actualA - expectedWinA)

  // Individual distribution: blend flat split with individual-weighted split.
  // delta_i = teamDelta * (1 + (2*weight_i - 1) * INDIVIDUAL_FACTOR)
  // Since weight_i sum to 1, both players' deltas still average to teamDelta.
  const [wA0, wA1] = individualWeights(playerAPTRs, avgPTRB, winner === 'A')
  const [wB0, wB1] = individualWeights(playerBPTRs, avgPTRA, winner === 'B')

  const r = (w: number) => Math.round(rawDelta * (1 + (2 * w - 1) * INDIVIDUAL_FACTOR) * 10) / 10

  const playerADeltas: [number, number] = [r(wA0), r(wA1)]
  const playerBDeltas: [number, number] = [-r(wB0), -r(wB1)]

  const teamADelta = Math.round(rawDelta * 10) / 10
  const teamBDelta = Math.round(-rawDelta * 10) / 10

  return {
    playerADeltas,
    playerBDeltas,
    teamADelta,
    teamBDelta,
    scoreMultiplier,
    expectedWinA,
    matchQuality,
    isUpset: upset,
  }
}

export function previewPTRChanges(
  playerAPTRs: [number, number],
  playerBPTRs: [number, number],
  playerAMatches: [number, number],
  playerBMatches: [number, number],
  sets: MatchSet[]
): PTRCalculation {
  const avgPTRA = (playerAPTRs[0] + playerAPTRs[1]) / 2
  const avgPTRB = (playerBPTRs[0] + playerBPTRs[1]) / 2

  const relA1 = calculateReliability(playerAMatches[0])
  const relA2 = calculateReliability(playerAMatches[1])
  const relB1 = calculateReliability(playerBMatches[0])
  const relB2 = calculateReliability(playerBMatches[1])
  const avgRel = (relA1 + relA2 + relB1 + relB2) / 4

  const K = calculateKFactor(avgRel)
  const expectedWinA = calculateExpectedWin(avgPTRA, avgPTRB)
  const scoreMultiplier = sets.length > 0 && (sets[0].teamAGames > 0 || sets[0].teamBGames > 0)
    ? calculateScoreMultiplier(sets, sets[0].teamAGames > sets[0].teamBGames ? 'A' : 'B')
    : 1.0

  const deltaIfAWins = Math.round(K * scoreMultiplier * (1 - expectedWinA) * 10) / 10
  const deltaIfBWins = Math.round(K * scoreMultiplier * expectedWinA * 10) / 10

  return {
    teamAAvgPTR: Math.round(avgPTRA),
    teamBAvgPTR: Math.round(avgPTRB),
    expectedWinProbA: Math.round(expectedWinA * 100),
    kFactor: Math.round(K),
    scoreMultiplier,
    deltaIfAWins,
    deltaIfBWins,
  }
}
