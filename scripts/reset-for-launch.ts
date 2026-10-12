import { PrismaClient } from '@prisma/client'
import { internalFromLevel } from '../src/lib/lta'

// One-off launch reset: deletes every account, player, match, event and
// analytics row EXCEPT one kept account (Cord van Eck) and the club list.
// The kept player's rating and stats go back to their sign-up level, since
// the matches behind them are deleted.
//
// Safe by default — without --confirm it only prints what it would delete:
//   npm run db:launch-reset
// To actually delete, pass the database host it prints, so it can't run
// against the wrong database by accident:
//   npm run db:launch-reset -- --confirm=<host>
//
// It uses whichever database the storage_* settings point to (.env = local).

const KEEP_NAME = 'Cord van Eck'
const prisma = new PrismaClient()

async function main() {
  const url = process.env.storage_DATABASE_URL_UNPOOLED || process.env.storage_POSTGRES_PRISMA_URL || ''
  const host = url ? new URL(url).hostname : '(not set)'
  const confirm = process.argv.find(a => a.startsWith('--confirm='))?.split('=')[1]

  const keep = await prisma.user.findMany({ where: { name: { equals: KEEP_NAME, mode: 'insensitive' } }, include: { player: true } })
  console.log(`Database host: ${host}`)
  if (keep.length !== 1 || !keep[0].player) {
    console.log(`Expected exactly one account named "${KEEP_NAME}" with a player profile, found ${keep.length}. Nothing changed.`)
    return
  }
  const user = keep[0]
  const player = user.player!
  console.log(`Keeping: ${user.name} <${user.email}> (player ${player.id})\n`)

  const counts = {
    'Users (others)': await prisma.user.count({ where: { id: { not: user.id } } }),
    'Players (others, incl. guests)': await prisma.player.count({ where: { id: { not: player.id } } }),
    'Matches': await prisma.match.count(),
    'Americano events': await prisma.americanoEvent.count(),
    'Round Robin events & leagues': await prisma.roundRobinEvent.count(),
    'Snake and Ladders events': await prisma.snakeLaddersEvent.count(),
    'Password reset links': await prisma.passwordReset.count(),
    'Sign-ins': await prisma.signIn.count(),
    'Active days': await prisma.activeDay.count(),
    'Error log': await prisma.errorLog.count(),
    'Match deletions': await prisma.matchDeletion.count(),
  }
  console.table(counts)
  console.log(`Kept: the club list (${await prisma.club.count()} clubs) and ${user.name}'s account.`)
  console.log(`${user.name}'s rating and stats reset to their sign-up level (${player.startingLevel ?? 'none set'}).\n`)

  // --rehearse: run the whole reset, report what's left, then roll it back.
  const rehearse = process.argv.includes('--rehearse')
  if (confirm !== host && !rehearse) {
    console.log(`Dry run — nothing deleted. To delete, run again with --confirm=${host}`)
    return
  }

  await prisma.$transaction(async tx => {
    // Matches and events first (their sets, history and fixtures cascade),
    // then other players, then other users (their resets, sign-ins and
    // active days cascade), then the standalone analytics tables.
    await tx.match.deleteMany({})
    await tx.americanoEvent.deleteMany({})
    await tx.roundRobinEvent.deleteMany({})
    await tx.snakeLaddersEvent.deleteMany({})
    await tx.player.deleteMany({ where: { id: { not: player.id } } })
    await tx.user.deleteMany({ where: { id: { not: user.id } } })
    await tx.passwordReset.deleteMany({})
    await tx.signIn.deleteMany({})
    await tx.activeDay.deleteMany({})
    await tx.errorLog.deleteMany({})
    await tx.matchDeletion.deleteMany({})
    await tx.player.update({
      where: { id: player.id },
      data: {
        ptr: player.startingLevel !== null ? internalFromLevel(player.startingLevel) : player.ptr,
        reliability: 0,
        matchesPlayed: 0, wins: 0, losses: 0,
        setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
        tiebreaksWon: 0, tiebreaksPlayed: 0,
        currentStreak: 0, bestStreak: 0,
        createdById: null, claimToken: null,
      },
    })
    if (rehearse) {
      console.log('Rehearsal — left after the reset:', {
        users: await tx.user.count(), players: await tx.player.count(), matches: await tx.match.count(),
        events: (await tx.americanoEvent.count()) + (await tx.roundRobinEvent.count()) + (await tx.snakeLaddersEvent.count()),
        clubs: await tx.club.count(), analytics: (await tx.signIn.count()) + (await tx.activeDay.count()) + (await tx.errorLog.count()),
      })
      throw new Error('ROLLBACK')
    }
  }, { timeout: 60_000 }).catch(e => {
    if (e.message !== 'ROLLBACK') throw e
    console.log('Rehearsal rolled back — nothing changed.')
  })
  if (!rehearse) console.log('Done — database reset for launch.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
