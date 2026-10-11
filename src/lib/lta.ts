// LTA Padel Rating System levels, and the bridge between them and the rating
// engine.
//
// The engine (ptr-algorithm.ts) is unchanged Elo: ratings live on an internal
// scale where 1000 is the historical default. Everything users see is on the
// LTA 1.0–7.0 scale. One LTA point = 200 internal points, so a team a full
// level above another is expected to win ~76% of the time, and 1000 maps to
// 3.5 (mid intermediate).

export const INTERNAL_PER_LEVEL = 200
const INTERNAL_AT_3_5 = 1000
export const MIN_LEVEL = 1
export const MAX_LEVEL = 7

export function levelFromInternal(internal: number): number {
  const level = 3.5 + (internal - INTERNAL_AT_3_5) / INTERNAL_PER_LEVEL
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level))
}

export function internalFromLevel(level: number): number {
  return INTERNAL_AT_3_5 + (level - 3.5) * INTERNAL_PER_LEVEL
}

// A rating change on the internal scale, expressed in LTA levels.
export function levelDelta(internalDelta: number): number {
  return internalDelta / INTERNAL_PER_LEVEL
}

export type LtaCategory = 'beginner' | 'intermediate' | 'advanced'

export interface LtaLevel {
  level: number
  category: LtaCategory
  statement: string
  // The same statement about someone else, for when you're rating a guest.
  aboutThem: string
}

export const LTA_CATEGORIES: { key: LtaCategory; label: string; blurb: string; blurbAboutThem: string }[] = [
  { key: 'beginner', label: 'Beginner', blurb: 'I’m just starting out', blurbAboutThem: 'They’re just starting out' },
  { key: 'intermediate', label: 'Intermediate', blurb: 'I play to a reasonable standard', blurbAboutThem: 'They play to a reasonable standard' },
  { key: 'advanced', label: 'Advanced', blurb: 'I compete at a national level', blurbAboutThem: 'They compete at a national level' },
]

export const LTA_LEVELS: LtaLevel[] = [
  { level: 1.0, category: 'beginner', statement: 'I am a beginner who is still working on getting the ball in play', aboutThem: 'They are a beginner who is still working on getting the ball in play' },
  { level: 2.0, category: 'beginner', statement: 'I can get the ball in play but my shots lack direction and control', aboutThem: 'They can get the ball in play but their shots lack direction and control' },
  { level: 2.5, category: 'beginner', statement: 'I can rally with basic shots but I lack technique', aboutThem: 'They can rally with basic shots but lack technique' },
  { level: 3.0, category: 'beginner', statement: 'I am pretty consistent and can use tactics like playing off the wall', aboutThem: 'They are pretty consistent and can use tactics like playing off the wall' },
  { level: 3.5, category: 'intermediate', statement: 'I lack technique but do have some control on the court. Competent tennis and squash players who are new to padel come under this category', aboutThem: 'They lack technique but do have some control on the court. Competent tennis and squash players who are new to padel come under this category' },
  { level: 4.0, category: 'intermediate', statement: 'I am quite controlled on the court, can cover it well, and have a basic understanding of padel tactics', aboutThem: 'They are quite controlled on the court, can cover it well, and have a basic understanding of padel tactics' },
  { level: 4.5, category: 'intermediate', statement: 'I am very good at covering the court, have a very good level of control, and have a good understanding of padel tactics', aboutThem: 'They are very good at covering the court, have a very good level of control, and have a good understanding of padel tactics' },
  { level: 5.0, category: 'intermediate', statement: 'I am an experienced tournament player who has a very good understanding of padel tactics', aboutThem: 'They are an experienced tournament player who has a very good understanding of padel tactics' },
  { level: 5.5, category: 'advanced', statement: 'I am a nationally-ranked padel player', aboutThem: 'They are a nationally-ranked padel player' },
  { level: 6.0, category: 'advanced', statement: 'I am a semi-professional player. I am outside the top 250 in the men’s professional rankings or top 150 in the women’s professional rankings', aboutThem: 'They are a semi-professional player — outside the top 250 in the men’s professional rankings or top 150 in the women’s' },
  { level: 6.5, category: 'advanced', statement: 'I am a professional player. I am inside the top 250 in the men’s professional rankings or top 150 in the women’s professional rankings', aboutThem: 'They are a professional player — inside the top 250 in the men’s professional rankings or top 150 in the women’s' },
  { level: 7.0, category: 'advanced', statement: 'I am a professional player. I am inside the top 150 in the men’s professional rankings or top 50 in the women’s professional rankings', aboutThem: 'They are a professional player — inside the top 150 in the men’s professional rankings or top 50 in the women’s' },
]

export function isLtaLevel(value: unknown): value is number {
  return typeof value === 'number' && LTA_LEVELS.some(l => l.level === value)
}

export function categoryOf(level: number): LtaCategory {
  return LTA_LEVELS.find(l => l.level === level)?.category ?? 'intermediate'
}
