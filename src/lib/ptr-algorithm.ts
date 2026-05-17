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
  // Quality 1-10 based on: closeness of PTRs + set closeness
  const ptrDiff = Math.abs(avgPTRA - avgPTRB)
  const ptrScore = Math.max(0, 5 - ptrDiff / 40) // 5 pts for equal teams

  let setCloseness = 0
  for (const set of sets) {
    const diff = Math.abs(set.teamAGames - set.teamBGames)
    setCloseness += Math.max(0, 3 - diff) // closer = better
  }
  const setScore = Math.min(5, setCloseness)

  return Math.min(10, Math.max(1, ptrScore + setScore))
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

export function calculatePTRChanges(
  playerAPTRs: [number, number],
  playerBPTRs: [number, number],
  playerAReliabilities: [number, number],
  playerBReliabilities: [number, number],
  sets: MatchSet[],
  winner: 'A' | 'B'
): {
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

  // Team A gains rawDelta, Team B loses same (zero-sum)
  return {
    teamADelta: Math.round(rawDelta * 10) / 10,
    teamBDelta: Math.round(-rawDelta * 10) / 10,
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
