import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPTR(ptr: number): string {
  return Math.round(ptr).toLocaleString()
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`
  return delta.toFixed(1)
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

export function getSetScore(sets: { teamAGames: number; teamBGames: number; setNumber: number }[], winner: 'A' | 'B'): string {
  const setsA = sets.filter(s => s.teamAGames > s.teamBGames).length
  const setsB = sets.filter(s => s.teamBGames > s.teamAGames).length
  return `${setsA}-${setsB}`
}

export function getFullScore(sets: { teamAGames: number; teamBGames: number; setNumber: number }[]): string {
  return sets
    .sort((a, b) => a.setNumber - b.setNumber)
    .map(s => `${s.teamAGames}-${s.teamBGames}`)
    .join(', ')
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
