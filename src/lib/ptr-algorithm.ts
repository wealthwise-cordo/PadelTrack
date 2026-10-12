import type { MatchSet, PTRCalculation } from '@/types'

const ELO_DIVISOR = 400

// --- Reliability ------------------------------------------------------------
// How settled a player's rating is, 1%–100%; volatility is its inverse.
// It grows towards 100% with each ranked match, following
//   reliability = 1 − e^(−c × matches)
// with c = 0.02773, so 25 matches ≈ 50%, 68 ≈ 85% and 93 ≈ 90%. New players
// start at the 1% floor — the most volatile they will ever be.
export const RELIABILITY_GROWTH = 0.02773
export const MIN_RELIABILITY = 0.01
// After more than 30 days without a ranked match, reliability decays by 0.05
// for every 30 days, down to a floor of 20% (it never lifts anyone below 20%
// up to it). The decayed value is kept and grows back as they play again.
export const DECAY_AFTER_DAYS = 30
export const DECAY_PER_30_DAYS = 0.05
export const DECAY_FLOOR = 0.2

const DAY_MS = 864e5
const clampReliability = (r: number) => Math.min(1, Math.max(MIN_RELIABILITY, r))

// One more ranked match: the same step along the curve as matches → matches + 1.
export function reliabilityAfterMatch(reliability: number): number {
  return clampReliability(1 - (1 - clampReliability(reliability)) * Math.exp(-RELIABILITY_GROWTH))
}

export function decayReliability(reliability: number, daysSinceLastMatch: number): number {
  const r = clampReliability(reliability)
  if (daysSinceLastMatch <= DECAY_AFTER_DAYS || r <= DECAY_FLOOR) return r
  return Math.max(DECAY_FLOOR, r - DECAY_PER_30_DAYS * (daysSinceLastMatch / 30))
}

// A player's reliability at a moment: their stored value, decayed for the
// time since their last ranked match. `at` defaults to now.
export function currentReliability(stored: number, lastRankedPlayedAt: Date | null, at: Date = new Date()): number {
  if (!lastRankedPlayedAt) return clampReliability(stored)
  return decayReliability(stored, Math.max(0, (at.getTime() - lastRankedPlayedAt.getTime()) / DAY_MS))
}

// --- Volatility ----------------------------------------------------------------
// Each player's own volatility (K, in internal points; 200 = one LTA level),
// calibrated against real results from the system PadelTrack mirrors:
//   K (levels) = 1.505 × (1 − reliability)^2.65 + 0.088
// It falls steeply as reliability builds — ~0.33 of a level at 50%, ~0.1 at
// 85%+ — so settled players move little and new ones move a lot. (Fitted as
// 1.63·(1−r)^2.65 + 0.095 with no score multiplier, then divided by ~1.083,
// the multiplier for a typical 6-4 6-4.) Capped at one level so a brand-new
// player moves at most about ±0.5 of a level on an even match.
const VOLATILITY_SCALE = 1.505
const VOLATILITY_POWER = 2.65
const VOLATILITY_FLOOR = 0.088
const VOLATILITY_CAP = 1.0 // levels

export function calculateKFactor(reliability: number): number {
  const r = clampReliability(reliability)
  const levels = Math.min(VOLATILITY_CAP, VOLATILITY_SCALE * Math.pow(1 - r, VOLATILITY_POWER) + VOLATILITY_FLOOR)
  return levels * 200
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

function setQualityScore(margin: number): number {
  if (margin <= 1) return 1          // 7-6 tiebreak
  if (margin <= 3) return 5 / 7     // 6-3, 6-4, 7-5
  if (margin <= 5) return 2 / 7     // 6-1, 6-2
  return 0                           // 6-0
}

export function calculateMatchQuality(
  _avgPTRA: number,
  _avgPTRB: number,
  sets: MatchSet[]
): number {
  const played = sets.filter(s => s.teamAGames + s.teamBGames > 0)
  if (played.length === 0) return 1

  const sum = played.reduce((acc, s) => acc + setQualityScore(Math.abs(s.teamAGames - s.teamBGames)), 0)
  const coeff = played.length === 3 ? 3.0 : 3.5

  return Math.min(10, Math.max(1, 1 + coeff * sum))
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

  // Each player moves by their own volatility, so partners can move
  // different amounts.
  const kA = playerAReliabilities.map(calculateKFactor) as [number, number]
  const kB = playerBReliabilities.map(calculateKFactor) as [number, number]

  const expectedWinA = calculateExpectedWin(avgPTRA, avgPTRB)
  const scoreMultiplier = calculateScoreMultiplier(sets, winner)
  const matchQuality = calculateMatchQuality(avgPTRA, avgPTRB, sets)
  const upset = isUpset(avgPTRA, avgPTRB, winner)

  const actualA = winner === 'A' ? 1 : 0
  // The team result before each player's own volatility is applied.
  const swing = scoreMultiplier * (actualA - expectedWinA)

  // Each player: their own volatility × the team result. Partners share the
  // team result (no split by who is stronger), so a weaker player paired
  // with a stronger one gains and loses on the pair's expectation.
  const r = (k: number) => Math.round(k * swing * 10) / 10

  const playerADeltas: [number, number] = [r(kA[0]), r(kA[1])]
  const playerBDeltas: [number, number] = [-r(kB[0]), -r(kB[1])]

  // Pair figures shown on the match: the average of the two partners.
  const teamADelta = Math.round(((playerADeltas[0] + playerADeltas[1]) / 2) * 10) / 10
  const teamBDelta = Math.round(((playerBDeltas[0] + playerBDeltas[1]) / 2) * 10) / 10

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

// Rough preview before a match is saved, from the four players' current
// reliabilities: the pair's average change if A or B wins.
export function previewPTRChanges(
  playerAPTRs: [number, number],
  playerBPTRs: [number, number],
  playerAReliabilities: [number, number],
  playerBReliabilities: [number, number],
  sets: MatchSet[]
): PTRCalculation {
  const avgPTRA = (playerAPTRs[0] + playerAPTRs[1]) / 2
  const avgPTRB = (playerBPTRs[0] + playerBPTRs[1]) / 2
  const kA = (calculateKFactor(playerAReliabilities[0]) + calculateKFactor(playerAReliabilities[1])) / 2
  const kB = (calculateKFactor(playerBReliabilities[0]) + calculateKFactor(playerBReliabilities[1])) / 2

  const expectedWinA = calculateExpectedWin(avgPTRA, avgPTRB)
  const scoreMultiplier = sets.length > 0 && (sets[0].teamAGames > 0 || sets[0].teamBGames > 0)
    ? calculateScoreMultiplier(sets, sets[0].teamAGames > sets[0].teamBGames ? 'A' : 'B')
    : 1.0

  const deltaIfAWins = Math.round(kA * scoreMultiplier * (1 - expectedWinA) * 10) / 10
  const deltaIfBWins = Math.round(kB * scoreMultiplier * expectedWinA * 10) / 10

  return {
    teamAAvgPTR: Math.round(avgPTRA),
    teamBAvgPTR: Math.round(avgPTRB),
    expectedWinProbA: Math.round(expectedWinA * 100),
    kFactor: Math.round((kA + kB) / 2),
    scoreMultiplier,
    deltaIfAWins,
    deltaIfBWins,
  }
}
