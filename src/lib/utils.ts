import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { levelFromInternal, levelDelta } from '@/lib/lta'

// A ranked match must have been played within this many days; older ones can
// only be friendlies.
export const RANKED_MAX_AGE_DAYS = 30

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Ratings are stored on the engine's internal scale and shown on the LTA
// 1.0–7.0 scale (see lib/lta.ts), to two decimals so match-by-match movement
// is visible.
export function formatRating(internal: number): string {
  return levelFromInternal(internal).toFixed(2)
}

// An internal rating change shown in LTA levels, e.g. "+0.12".
export function formatRatingDelta(internalDelta: number): string {
  const d = levelDelta(internalDelta)
  const rounded = Math.abs(d) < 0.005 ? 0 : d
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded).toFixed(2)}`
}

export function getStreakLabel(streak: number): string {
  if (streak >= 3) return `W${streak}`
  if (streak <= -3) return `L${Math.abs(streak)}`
  if (streak > 0) return `W${streak}`
  if (streak < 0) return `L${Math.abs(streak)}`
  return '-'
}

export function getWinRate(wins: number, total: number): number {
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

/**
 * A padel set is only complete when the score reaches a valid endpoint:
 *   - 6-x with a 2+ game lead  (6-0 through 6-4)
 *   - 7-5  (won from 5-5)
 *   - 7-6  (tiebreak)
 * Scores like 6-5 or 3-2 are in-progress and do not constitute a set win.
 */
export function isSetComplete(a: number, b: number): boolean {
  const max = Math.max(a, b)
  const min = Math.min(a, b)
  return (max >= 6 && max - min >= 2) || (max === 7 && min === 6)
}

export function setWinner(a: number, b: number): 'A' | 'B' | null {
  if (!isSetComplete(a, b)) return null
  return a > b ? 'A' : 'B'
}

export function getSetScore(sets: { teamAGames: number; teamBGames: number; setNumber: number }[]): string {
  const setsA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const setsB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  return `${setsA}-${setsB}`
}

export function getFullScore(sets: { teamAGames: number; teamBGames: number; setNumber: number }[]): string {
  return sets
    .filter(s => s.teamAGames + s.teamBGames > 0)
    .sort((a, b) => a.setNumber - b.setNumber)
    .map(s => `${s.teamAGames}-${s.teamBGames}`)
    .join('  ')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getReliabilityLabel(reliability: number): string {
  if (reliability < 0.3) return 'Calibrating'
  if (reliability < 0.6) return 'Developing'
  if (reliability < 0.85) return 'Established'
  return 'Veteran'
}

// "2026 - Cartagena, Spain" — season.name holds the year.
export function seasonLabel(s: { name: string; location: string }): string {
  return `${s.name} - ${s.location}`
}
