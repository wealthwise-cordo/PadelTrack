import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  calculatePTRChanges,
  calculateReliability,
  calculateMatchQuality,
  isUpset,
} from '@/lib/ptr-algorithm'

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: {
        teamAPlayer1: true,
        teamAPlayer2: true,
        teamBPlayer1: true,
        teamBPlayer2: true,
        sets: { orderBy: { setNumber: 'asc' } },
      },
      orderBy: { playedAt: 'desc' },
    })

    return NextResponse.json(
      matches.map(m => ({
        ...m,
        playedAt: m.playedAt.toISOString(),
        submittedAt: m.submittedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      teamAPlayer1Id,
      teamAPlayer2Id,
      teamBPlayer1Id,
      teamBPlayer2Id,
      sets,
      winner,
    } = body

    // Validate unique players
    const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
    if (new Set(ids).size !== 4) {
      return NextResponse.json({ error: 'All four players must be different' }, { status: 400 })
    }

    // Fetch players
    const [p1, p2, p3, p4] = await Promise.all([
      prisma.player.findUnique({ where: { id: teamAPlayer1Id } }),
      prisma.player.findUnique({ where: { id: teamAPlayer2Id } }),
      prisma.player.findUnique({ where: { id: teamBPlayer1Id } }),
      prisma.player.findUnique({ where: { id: teamBPlayer2Id } }),
    ])

    if (!p1 || !p2 || !p3 || !p4) {
      return NextResponse.json({ error: 'One or more players not found' }, { status: 404 })
    }

    const teamAPTRBefore = (p1.ptr + p2.ptr) / 2
    const teamBPTRBefore = (p3.ptr + p4.ptr) / 2

    const result = calculatePTRChanges(
      [p1.ptr, p2.ptr],
      [p3.ptr, p4.ptr],
      [calculateReliability(p1.matchesPlayed), calculateReliability(p2.matchesPlayed)],
      [calculateReliability(p3.matchesPlayed), calculateReliability(p4.matchesPlayed)],
      sets,
      winner
    )

    const teamANewPTR = teamAPTRBefore + result.teamADelta
    const teamBNewPTR = teamBPTRBefore + result.teamBDelta

    // Calculate new individual PTRs
    const p1NewPTR = p1.ptr + result.teamADelta
    const p2NewPTR = p2.ptr + result.teamADelta
    const p3NewPTR = p3.ptr + result.teamBDelta
    const p4NewPTR = p4.ptr + result.teamBDelta

    // Stats
    const setsA = sets.filter((s: { teamAGames: number; teamBGames: number }) => s.teamAGames > s.teamBGames).length
    const setsB = sets.filter((s: { teamAGames: number; teamBGames: number }) => s.teamBGames > s.teamAGames).length
    const gamesA = sets.reduce((acc: number, s: { teamAGames: number }) => acc + s.teamAGames, 0)
    const gamesB = sets.reduce((acc: number, s: { teamBGames: number }) => acc + s.teamBGames, 0)

    // Create match in transaction
    const match = await prisma.$transaction(async (tx) => {
      const newMatch = await tx.match.create({
        data: {
          teamAPlayer1Id,
          teamAPlayer2Id,
          teamBPlayer1Id,
          teamBPlayer2Id,
          winner,
          teamAPTRBefore,
          teamBPTRBefore,
          teamAPTRAfter: teamANewPTR,
          teamBPTRAfter: teamBNewPTR,
          ptrDelta: Math.abs(result.teamADelta),
          scoreMultiplier: result.scoreMultiplier,
          isUpset: result.isUpset,
          matchQuality: result.matchQuality,
          sets: {
            create: sets.map((s: { teamAGames: number; teamBGames: number }, i: number) => ({
              setNumber: i + 1,
              teamAGames: s.teamAGames,
              teamBGames: s.teamBGames,
            })),
          },
        },
      })

      // Create PTR history for each player
      await tx.pTRHistory.createMany({
        data: [
          { playerId: p1.id, matchId: newMatch.id, ptrBefore: p1.ptr, ptrAfter: p1NewPTR, delta: result.teamADelta, reliability: calculateReliability(p1.matchesPlayed + 1) },
          { playerId: p2.id, matchId: newMatch.id, ptrBefore: p2.ptr, ptrAfter: p2NewPTR, delta: result.teamADelta, reliability: calculateReliability(p2.matchesPlayed + 1) },
          { playerId: p3.id, matchId: newMatch.id, ptrBefore: p3.ptr, ptrAfter: p3NewPTR, delta: result.teamBDelta, reliability: calculateReliability(p3.matchesPlayed + 1) },
          { playerId: p4.id, matchId: newMatch.id, ptrBefore: p4.ptr, ptrAfter: p4NewPTR, delta: result.teamBDelta, reliability: calculateReliability(p4.matchesPlayed + 1) },
        ],
      })

      // Update players
      const updatePlayer = (
        player: typeof p1,
        newPtr: number,
        isWinner: boolean,
        setsWon: number,
        setsLost: number,
        gWon: number,
        gLost: number
      ) => tx.player.update({
        where: { id: player.id },
        data: {
          ptr: newPtr,
          matchesPlayed: player.matchesPlayed + 1,
          reliability: calculateReliability(player.matchesPlayed + 1),
          wins: isWinner ? player.wins + 1 : player.wins,
          losses: isWinner ? player.losses : player.losses + 1,
          setsWon: player.setsWon + setsWon,
          setsLost: player.setsLost + setsLost,
          gamesWon: player.gamesWon + gWon,
          gamesLost: player.gamesLost + gLost,
          currentStreak: isWinner
            ? (player.currentStreak > 0 ? player.currentStreak + 1 : 1)
            : (player.currentStreak < 0 ? player.currentStreak - 1 : -1),
          bestStreak: isWinner
            ? Math.max(player.bestStreak, player.currentStreak > 0 ? player.currentStreak + 1 : 1)
            : player.bestStreak,
        },
      })

      await Promise.all([
        updatePlayer(p1, p1NewPTR, winner === 'A', setsA, setsB, gamesA, gamesB),
        updatePlayer(p2, p2NewPTR, winner === 'A', setsA, setsB, gamesA, gamesB),
        updatePlayer(p3, p3NewPTR, winner === 'B', setsB, setsA, gamesB, gamesA),
        updatePlayer(p4, p4NewPTR, winner === 'B', setsB, setsA, gamesB, gamesA),
      ])

      return newMatch
    })

    return NextResponse.json({ success: true, matchId: match.id, result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}
