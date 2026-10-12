import { PrismaClient } from '@prisma/client'

// Monthly review: venues players typed in via "My venue isn't listed" (matches
// with a location but no club), most used first, so new clubs can be added to
// the Club table with a migration. Read-only.
//
//   npm run venues:review          # last 31 days
//   npm run venues:review -- 90    # last 90 days

const prisma = new PrismaClient()

async function main() {
  const days = Number(process.argv[2]) || 31
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const matches = await prisma.match.findMany({
    where: { clubId: null, location: { not: null }, submittedAt: { gte: since } },
    select: { location: true, playedAt: true, recordedById: true },
  })

  // Group spellings that differ only in case and spacing.
  const venues = new Map<string, { names: Map<string, number>; matches: number; recorders: Set<string>; lastPlayed: Date }>()
  for (const m of matches) {
    const name = m.location!.trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    const v = venues.get(key) ?? { names: new Map(), matches: 0, recorders: new Set(), lastPlayed: m.playedAt }
    v.names.set(name, (v.names.get(name) ?? 0) + 1)
    v.matches++
    v.recorders.add(m.recordedById)
    if (m.playedAt > v.lastPlayed) v.lastPlayed = m.playedAt
    venues.set(key, v)
  }

  console.log(`Unlisted venues in matches recorded in the last ${days} days: ${venues.size}\n`)
  const rows = Array.from(venues.values())
    .sort((a, b) => b.matches - a.matches || b.lastPlayed.getTime() - a.lastPlayed.getTime())
    .map(v => ({
      venue: Array.from(v.names.entries()).sort((a, b) => b[1] - a[1])[0][0],
      matches: v.matches,
      users: v.recorders.size, // how many people recorded matches there
      lastPlayed: v.lastPlayed.toISOString().slice(0, 10),
      spellings: v.names.size > 1 ? Array.from(v.names.keys()).join(' | ') : '',
    }))
  if (rows.length) console.table(rows)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
