// Demo data for App Store screenshots and local testing: made-up players and
// a month of ranked matches, run through PadelTrack's own match logic so
// ratings, history and rankings are real. Wipes the database first, so it
// refuses to run against anything but a localhost database.
// Run (with `npm run demo:db` going): npm run demo:seed
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'
import { createMatch, confirmMatch } from '../src/lib/store'
import { internalFromLevel } from '../src/lib/lta'
import { LEGAL_VERSION } from '../src/lib/legal'

const url = process.env.storage_POSTGRES_PRISMA_URL ?? ''
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed: storage_POSTGRES_PRISMA_URL is not a localhost database.')
  process.exit(1)
}

export const DEMO_PASSWORD = 'padeltrack-demo'
const VENUES = ['Riverside Padel Club', 'Northbank Padel', 'The Glasshouse Courts']

// The viewer first: their account is the one to sign in with for screenshots.
const PLAYERS = [
  { name: 'Alex Morgan', level: 3.5, color: '#f97316', gender: 'male' },
  { name: 'Sam Carter', level: 4.0, color: '#0ea5e9', gender: 'male' },
  { name: 'Maya Lopez', level: 3.5, color: '#8b5cf6', gender: 'female' },
  { name: 'Tom Fletcher', level: 3.0, color: '#10b981', gender: 'male' },
  { name: 'Priya Shah', level: 4.0, color: '#e11d48', gender: 'female' },
  { name: 'Leo Martins', level: 4.5, color: '#3f3f46', gender: 'male' },
  { name: 'Grace Kim', level: 3.0, color: '#f59e0b', gender: 'female' },
  { name: 'Dan Hughes', level: 3.5, color: '#64748b', gender: 'male' },
  { name: 'Isla Reid', level: 2.5, color: '#0ea5e9', gender: 'female' },
  { name: 'Noah Bennett', level: 4.0, color: '#8b5cf6', gender: 'male' },
]

// Repeatable "random", so the screenshots come out the same each run.
let seed = 20261101
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const shuffle = <T,>(xs: T[]) => [...xs].sort(() => rand() - 0.5)

const dayOffset = (days: number) => {
  const d = new Date(Date.now() - days * 864e5)
  return d.toISOString().slice(0, 10)
}

// A believable score for a match `winner` won: two sets, sometimes three.
function score(winner: 'A' | 'B') {
  const set = (aWins: boolean) => {
    const [w, l] = pick([[6, 2], [6, 3], [6, 4], [6, 4], [7, 5], [7, 6], [6, 1]])
    return aWins ? { teamAGames: w, teamBGames: l } : { teamAGames: l, teamBGames: w }
  }
  const aWon = winner === 'A'
  return rand() < 0.3 ? [set(aWon), set(!aWon), set(aWon)] : [set(aWon), set(aWon)]
}

async function wipe() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  )
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} CASCADE`)
}

async function main() {
  console.log('Wiping the local demo database…')
  await wipe()
  const password = await bcrypt.hash(DEMO_PASSWORD, 10)

  const people: { userId: string; playerId: string; name: string }[] = []
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]
    const email = p.name.toLowerCase().replace(/ /g, '.') + '@demo.padeltrack'
    const user = await prisma.user.create({
      data: {
        email, password, name: p.name, gender: p.gender, country: 'GB',
        dateOfBirth: new Date(Date.UTC(1985 + i, i % 12, 10 + i)),
        termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION,
      },
    })
    const player = await prisma.player.create({
      data: { name: p.name, avatarColor: p.color, userId: user.id, startingLevel: p.level, ptr: internalFromLevel(p.level) },
    })
    people.push({ userId: user.id, playerId: player.id, name: p.name })
  }
  const [me, ...others] = people
  console.log(`  ✓ ${people.length} players (sign in as alex.morgan@demo.padeltrack / ${DEMO_PASSWORD})`)

  // About two ranked matches a day over the last four weeks, oldest first so
  // ratings build up in order. Alex plays in roughly half and wins most.
  let ranked = 0
  for (let day = 27; day >= 1; day--) {
    for (let n = rand() < 0.4 ? 2 : 1; n > 0; n--) {
      const withMe = rand() < 0.55
      const four = withMe ? [me, ...shuffle(others).slice(0, 3)] : shuffle(others).slice(0, 4)
      const [a1, a2, b1, b2] = four
      const winner: 'A' | 'B' = withMe ? (rand() < 0.68 ? 'A' : 'B') : (rand() < 0.5 ? 'A' : 'B')
      const made = await createMatch(a1.userId, {
        teamAPlayer1Id: a1.playerId, teamAPlayer2Id: a2.playerId, teamBPlayer1Id: b1.playerId, teamBPlayer2Id: b2.playerId,
        sets: score(winner), winner, playedOn: dayOffset(day), location: pick(VENUES), isRanked: true,
      })
      if ('error' in made) throw new Error(made.error)
      const confirmed = await confirmMatch(made.matchId, b1.userId)
      if ('error' in confirmed) throw new Error(confirmed.error)
      ranked++
    }
  }
  console.log(`  ✓ ${ranked} confirmed ranked matches`)

  // A couple of friendlies.
  for (const day of [12, 5]) {
    const [a2, b1, b2] = shuffle(others).slice(0, 3)
    const made = await createMatch(me.userId, {
      teamAPlayer1Id: me.playerId, teamAPlayer2Id: a2.playerId, teamBPlayer1Id: b1.playerId, teamBPlayer2Id: b2.playerId,
      sets: score('A'), winner: 'A', playedOn: dayOffset(day), location: pick(VENUES), isRanked: false,
    })
    if ('error' in made) throw new Error(made.error)
  }
  console.log('  ✓ 2 friendlies')

  // One waiting for Alex to confirm (recorded by an opponent today).
  {
    const [b2, a1, a2] = shuffle(others).slice(0, 3)
    const made = await createMatch(a1.userId, {
      teamAPlayer1Id: a1.playerId, teamAPlayer2Id: a2.playerId, teamBPlayer1Id: me.playerId, teamBPlayer2Id: b2.playerId,
      sets: [{ teamAGames: 6, teamBGames: 4 }, { teamAGames: 3, teamBGames: 6 }, { teamAGames: 6, teamBGames: 3 }],
      winner: 'A', location: VENUES[0], isRanked: true,
    })
    if ('error' in made) throw new Error(made.error)
  }
  console.log('  ✓ 1 match waiting for Alex to confirm')

  // Coming up: Saturday-ish at 10:00, one spot still open.
  {
    const start = new Date(Date.now() + 3 * 864e5)
    start.setUTCHours(10, 0, 0, 0)
    const [partner, opp] = shuffle(others).slice(0, 2)
    const made = await createMatch(me.userId, {
      teamAPlayer1Id: me.playerId, teamAPlayer2Id: partner.playerId, teamBPlayer1Id: opp.playerId, teamBPlayer2Id: null,
      sets: [], winner: null, startsAt: start.toISOString(), location: VENUES[1], isRanked: true,
    })
    if ('error' in made) throw new Error(made.error)
  }
  console.log('  ✓ 1 upcoming match with an open spot')

  console.log(`Done. Sign in as alex.morgan@demo.padeltrack with password ${DEMO_PASSWORD}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
