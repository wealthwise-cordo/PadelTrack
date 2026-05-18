import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function setQualityScore(margin: number): number {
  if (margin <= 1) return 1
  if (margin <= 3) return 5 / 7
  if (margin <= 5) return 2 / 7
  return 0
}

function calculateMatchQuality(sets: { teamAGames: number; teamBGames: number }[]): number {
  const played = sets.filter(s => s.teamAGames + s.teamBGames > 0)
  if (played.length === 0) return 1
  const sum = played.reduce((acc, s) => acc + setQualityScore(Math.abs(s.teamAGames - s.teamBGames)), 0)
  const coeff = played.length === 3 ? 3.0 : 3.5
  return Math.min(10, Math.max(1, 1 + coeff * sum))
}

async function main() {
  const matches = await prisma.match.findMany({ include: { sets: { orderBy: { setNumber: 'asc' } } } })
  console.log(`Recalculating quality for ${matches.length} matches...`)

  for (const match of matches) {
    const quality = calculateMatchQuality(match.sets)
    await prisma.match.update({ where: { id: match.id }, data: { matchQuality: quality } })
    console.log(`  ${match.id.slice(-6)}: ${match.matchQuality.toFixed(1)} → ${quality.toFixed(1)}`)
  }

  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
