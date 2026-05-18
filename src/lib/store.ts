import { prisma } from './prisma'
import {
  calculatePTRChanges,
  calculateReliability,
} from './ptr-algorithm'
import type { PlayerWithStats, MatchWithPlayers, PTRHistoryPoint } from '@/types'
import type { Player, PTRHistory, Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

type PlayerWithHistory = Player & { ptrHistory: PTRHistory[] }
type MatchFull = Prisma.MatchGetPayload<{
  include: {
    teamAPlayer1: true; teamAPlayer2: true
    teamBPlayer1: true; teamBPlayer2: true
    sets: { orderBy: { setNumber: 'asc' } }
  }
}>

function toPlayerWithStats(p: PlayerWithHistory, rank: number): PlayerWithStats {
  const history = [...p.ptrHistory].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatarColor: p.avatarColor,
    ptr: p.ptr,
    reliability: p.reliability,
    matchesPlayed: p.matchesPlayed,
    wins: p.wins,
    losses: p.losses,
    setsWon: p.setsWon,
    setsLost: p.setsLost,
    gamesWon: p.gamesWon,
    gamesLost: p.gamesLost,
    tiebreaksWon: p.tiebreaksWon,
    tiebreaksPlayed: p.tiebreaksPlayed,
    currentStreak: p.currentStreak,
    bestStreak: p.bestStreak,
    ptrHistory: history.map(h => ({
      id: h.id,
      ptrBefore: h.ptrBefore,
      ptrAfter: h.ptrAfter,
      delta: h.delta,
      reliability: h.reliability,
      createdAt: h.createdAt.toISOString(),
      matchId: h.matchId,
    } satisfies PTRHistoryPoint)),
    rank,
    ptrDelta: history.length > 0 ? history[history.length - 1].delta : 0,
  }
}

function toPlayerStub(p: Player): PlayerWithStats {
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatarColor: p.avatarColor,
    ptr: p.ptr,
    reliability: p.reliability,
    matchesPlayed: p.matchesPlayed,
    wins: p.wins,
    losses: p.losses,
    setsWon: p.setsWon,
    setsLost: p.setsLost,
    gamesWon: p.gamesWon,
    gamesLost: p.gamesLost,
    tiebreaksWon: p.tiebreaksWon,
    tiebreaksPlayed: p.tiebreaksPlayed,
    currentStreak: p.currentStreak,
    bestStreak: p.bestStreak,
    ptrHistory: [],
    rank: 0,
    ptrDelta: 0,
  }
}

function hydrateMatch(m: MatchFull): MatchWithPlayers {
  return {
    id: m.id,
    playedAt: m.playedAt.toISOString(),
    status: m.status as 'complete' | 'incomplete',
    winner: m.winner as 'A' | 'B' | null,
    teamAPlayer1Id: m.teamAPlayer1Id,
    teamAPlayer2Id: m.teamAPlayer2Id,
    teamBPlayer1Id: m.teamBPlayer1Id,
    teamBPlayer2Id: m.teamBPlayer2Id,
    teamAPlayer1: toPlayerStub(m.teamAPlayer1),
    teamAPlayer2: toPlayerStub(m.teamAPlayer2),
    teamBPlayer1: toPlayerStub(m.teamBPlayer1),
    teamBPlayer2: toPlayerStub(m.teamBPlayer2),
    teamAPTRBefore: m.teamAPTRBefore,
    teamBPTRBefore: m.teamBPTRBefore,
    teamAPTRAfter: m.teamAPTRAfter,
    teamBPTRAfter: m.teamBPTRAfter,
    ptrDelta: m.ptrDelta,
    scoreMultiplier: m.scoreMultiplier,
    isUpset: m.isUpset,
    matchQuality: m.matchQuality,
    sets: m.sets.map(s => ({
      setNumber: s.setNumber,
      teamAGames: s.teamAGames,
      teamBGames: s.teamBGames,
    })),
  }
}

const MATCH_INCLUDE = {
  teamAPlayer1: true, teamAPlayer2: true,
  teamBPlayer1: true, teamBPlayer2: true,
  sets: { orderBy: { setNumber: 'asc' as const } },
} satisfies Prisma.MatchInclude

// ---------------------------------------------------------------------------
// Player queries
// ---------------------------------------------------------------------------

export async function getPlayers(): Promise<PlayerWithStats[]> {
  const players = await prisma.player.findMany({
    include: { ptrHistory: true },
    orderBy: { ptr: 'desc' },
  })
  return players.map((p, i) => toPlayerWithStats(p, i + 1))
}

export async function getPlayer(id: string): Promise<PlayerWithStats | null> {
  const p = await prisma.player.findUnique({
    where: { id },
    include: { ptrHistory: true },
  })
  if (!p) return null
  return toPlayerWithStats(p, 0)
}

export async function getPlayerRaw(id: string): Promise<Player | null> {
  return prisma.player.findUnique({ where: { id } })
}

// ---------------------------------------------------------------------------
// Match queries
// ---------------------------------------------------------------------------

export async function getMatches(): Promise<MatchWithPlayers[]> {
  const matches = await prisma.match.findMany({
    include: MATCH_INCLUDE,
    orderBy: { playedAt: 'desc' },
  })
  return matches.map(hydrateMatch)
}

export async function getMatchById(id: string): Promise<MatchWithPlayers | null> {
  const m = await prisma.match.findUnique({ where: { id }, include: MATCH_INCLUDE })
  return m ? hydrateMatch(m) : null
}

export async function getMatchCount(): Promise<number> {
  return prisma.match.count()
}

// ---------------------------------------------------------------------------
// Match creation
// ---------------------------------------------------------------------------

export async function createMatch(data: {
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  sets: { teamAGames: number; teamBGames: number }[]
  winner: 'A' | 'B' | null
  status: 'complete' | 'incomplete'
}): Promise<{ matchId: string; ptrDelta: number; isUpset: boolean; status: string } | { error: string }> {
  const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner, status } = data

  const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
  if (new Set(ids).size !== 4) return { error: 'All four players must be different' }

  const [p1, p2, p3, p4] = await Promise.all(ids.map(id => prisma.player.findUnique({ where: { id } })))
  if (!p1 || !p2 || !p3 || !p4) return { error: 'One or more players not found' }

  const teamAPTRBefore = (p1.ptr + p2.ptr) / 2
  const teamBPTRBefore = (p3.ptr + p4.ptr) / 2

  if (status === 'complete' && winner) {
    return prisma.$transaction(async tx => {
      const match = await tx.match.create({
        data: {
          status,
          teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
          teamAPTRBefore, teamBPTRBefore,
          teamAPTRAfter: teamAPTRBefore,
          teamBPTRAfter: teamBPTRBefore,
          sets: { create: sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })) },
        },
      })
      const result = await applyPTR(tx, match.id, { p1, p2, p3, p4 }, sets, winner, teamAPTRBefore, teamBPTRBefore)
      return { matchId: match.id, ptrDelta: result.ptrDelta, isUpset: result.isUpset, status }
    })
  }

  const match = await prisma.match.create({
    data: {
      status: 'incomplete',
      winner: null,
      teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
      teamAPTRBefore, teamBPTRBefore,
      teamAPTRAfter: teamAPTRBefore,
      teamBPTRAfter: teamBPTRBefore,
      sets: { create: sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })) },
    },
  })
  return { matchId: match.id, ptrDelta: 0, isUpset: false, status: 'incomplete' }
}

// ---------------------------------------------------------------------------
// Match update (complete an incomplete match)
// ---------------------------------------------------------------------------

export async function updateMatch(
  id: string,
  sets: { teamAGames: number; teamBGames: number }[],
  winner: 'A' | 'B' | null,
  status: 'complete' | 'incomplete'
): Promise<{ ok: true } | { error: string }> {
  const match = await prisma.match.findUnique({ where: { id } })
  if (!match) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Cannot edit a completed match' }

  if (status === 'complete' && winner) {
    const [p1, p2, p3, p4] = await Promise.all([
      prisma.player.findUnique({ where: { id: match.teamAPlayer1Id } }),
      prisma.player.findUnique({ where: { id: match.teamAPlayer2Id } }),
      prisma.player.findUnique({ where: { id: match.teamBPlayer1Id } }),
      prisma.player.findUnique({ where: { id: match.teamBPlayer2Id } }),
    ])
    if (!p1 || !p2 || !p3 || !p4) return { error: 'Player not found' }

    await prisma.$transaction(async tx => {
      // Replace sets
      await tx.matchSet.deleteMany({ where: { matchId: id } })
      await tx.matchSet.createMany({
        data: sets.map((s, i) => ({ matchId: id, setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })),
      })
      await applyPTR(tx, id, { p1, p2, p3, p4 }, sets, winner, match.teamAPTRBefore, match.teamBPTRBefore)
    })
  } else {
    await prisma.$transaction([
      prisma.matchSet.deleteMany({ where: { matchId: id } }),
      prisma.matchSet.createMany({
        data: sets.map((s, i) => ({ matchId: id, setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })),
      }),
      prisma.match.update({ where: { id }, data: { status: 'incomplete', winner: null } }),
    ])
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Player update
// ---------------------------------------------------------------------------

export async function updatePlayer(
  id: string,
  data: { nickname?: string; avatarColor?: string }
): Promise<{ ok: true } | { error: string }> {
  const p = await prisma.player.findUnique({ where: { id } })
  if (!p) return { error: 'Player not found' }
  await prisma.player.update({ where: { id }, data })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Admin: delete a single match and reverse its PTR impact
// ---------------------------------------------------------------------------

export async function deleteMatch(id: string): Promise<{ ok: true } | { error: string }> {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id },
      include: { sets: true, ptrHistory: true },
    })
    if (!match) return { error: 'Match not found' }

    if (match.status === 'complete' && match.winner) {
      const [p1, p2, p3, p4] = await Promise.all([
        tx.player.findUnique({ where: { id: match.teamAPlayer1Id } }),
        tx.player.findUnique({ where: { id: match.teamAPlayer2Id } }),
        tx.player.findUnique({ where: { id: match.teamBPlayer1Id } }),
        tx.player.findUnique({ where: { id: match.teamBPlayer2Id } }),
      ])
      if (!p1 || !p2 || !p3 || !p4) return { error: 'Player not found' }

      const winner = match.winner as 'A' | 'B'
      const played = match.sets.filter(s => s.teamAGames + s.teamBGames > 0)
      const setsA = played.filter(s => s.teamAGames > s.teamBGames).length
      const setsB = played.filter(s => s.teamBGames > s.teamAGames).length
      const gamesA = played.reduce((a, s) => a + s.teamAGames, 0)
      const gamesB = played.reduce((a, s) => a + s.teamBGames, 0)
      const tbWonA = match.sets.filter(s => s.teamAGames === 7 && s.teamBGames === 6).length
      const tbWonB = match.sets.filter(s => s.teamBGames === 7 && s.teamAGames === 6).length
      const tbTotal = tbWonA + tbWonB
      const getDelta = (pid: string) => match.ptrHistory.find(h => h.playerId === pid)?.delta ?? 0

      const reversePlayer = (p: Player, isWinner: boolean, sw: number, sl: number, gw: number, gl: number, tbWon: number) => {
        const newMatches = Math.max(0, p.matchesPlayed - 1)
        return tx.player.update({
          where: { id: p.id },
          data: {
            ptr: p.ptr - getDelta(p.id),
            matchesPlayed: newMatches,
            reliability: calculateReliability(newMatches),
            wins: isWinner ? Math.max(0, p.wins - 1) : p.wins,
            losses: isWinner ? p.losses : Math.max(0, p.losses - 1),
            setsWon: Math.max(0, p.setsWon - sw),
            setsLost: Math.max(0, p.setsLost - sl),
            gamesWon: Math.max(0, p.gamesWon - gw),
            gamesLost: Math.max(0, p.gamesLost - gl),
            tiebreaksWon: Math.max(0, p.tiebreaksWon - tbWon),
            tiebreaksPlayed: Math.max(0, p.tiebreaksPlayed - tbTotal),
            currentStreak: 0,
          },
        })
      }

      await Promise.all([
        reversePlayer(p1, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
        reversePlayer(p2, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
        reversePlayer(p3, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
        reversePlayer(p4, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
      ])
    }

    await tx.pTRHistory.deleteMany({ where: { matchId: id } })
    await tx.matchSet.deleteMany({ where: { matchId: id } })
    await tx.match.delete({ where: { id } })
    return { ok: true as const }
  })
}

// ---------------------------------------------------------------------------
// Admin: reset entire database (wipe matches, restore all players to 1000 PTR)
// ---------------------------------------------------------------------------

export async function resetDatabase(): Promise<{ ok: true }> {
  await prisma.$transaction(async tx => {
    await tx.pTRHistory.deleteMany()
    await tx.matchSet.deleteMany()
    await tx.match.deleteMany()
    await tx.player.updateMany({
      data: {
        ptr: 1000,
        reliability: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        tiebreaksWon: 0,
        tiebreaksPlayed: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
    })
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

// ---------------------------------------------------------------------------
// Internal PTR application (runs inside a transaction)
// ---------------------------------------------------------------------------

type TxClient = Prisma.TransactionClient

async function applyPTR(
  tx: TxClient,
  matchId: string,
  players: { p1: Player; p2: Player; p3: Player; p4: Player },
  sets: { teamAGames: number; teamBGames: number }[],
  winner: 'A' | 'B',
  teamAPTRBefore: number,
  teamBPTRBefore: number,
): Promise<{ ptrDelta: number; isUpset: boolean }> {
  const { p1, p2, p3, p4 } = players

  const result = calculatePTRChanges(
    [p1.ptr, p2.ptr],
    [p3.ptr, p4.ptr],
    [calculateReliability(p1.matchesPlayed), calculateReliability(p2.matchesPlayed)],
    [calculateReliability(p3.matchesPlayed), calculateReliability(p4.matchesPlayed)],
    sets.map((s, i) => ({ setNumber: i + 1, ...s })),
    winner,
  )

  const playedSets = sets.filter(s => s.teamAGames + s.teamBGames > 0)
  const setsA = playedSets.filter(s => s.teamAGames > s.teamBGames).length
  const setsB = playedSets.filter(s => s.teamBGames > s.teamAGames).length
  const gamesA = playedSets.reduce((acc, s) => acc + s.teamAGames, 0)
  const gamesB = playedSets.reduce((acc, s) => acc + s.teamBGames, 0)

  const tbWonA = sets.filter(s => s.teamAGames === 7 && s.teamBGames === 6).length
  const tbWonB = sets.filter(s => s.teamBGames === 7 && s.teamAGames === 6).length
  const tbTotal = tbWonA + tbWonB

  const [dA1, dA2] = result.playerADeltas
  const [dB1, dB2] = result.playerBDeltas

  const updatePlayer = (p: Player, delta: number, isWinner: boolean, sw: number, sl: number, gw: number, gl: number, tbWon: number) => {
    const newMatches = p.matchesPlayed + 1
    const newStreak = isWinner
      ? (p.currentStreak > 0 ? p.currentStreak + 1 : 1)
      : (p.currentStreak < 0 ? p.currentStreak - 1 : -1)
    return tx.player.update({
      where: { id: p.id },
      data: {
        ptr: p.ptr + delta,
        matchesPlayed: newMatches,
        reliability: calculateReliability(newMatches),
        wins: isWinner ? p.wins + 1 : p.wins,
        losses: isWinner ? p.losses : p.losses + 1,
        setsWon: p.setsWon + sw,
        setsLost: p.setsLost + sl,
        gamesWon: p.gamesWon + gw,
        gamesLost: p.gamesLost + gl,
        tiebreaksWon: p.tiebreaksWon + tbWon,
        tiebreaksPlayed: p.tiebreaksPlayed + tbTotal,
        currentStreak: newStreak,
        bestStreak: isWinner ? Math.max(p.bestStreak, newStreak) : p.bestStreak,
      },
    })
  }

  const ptrHistory = (p: Player, delta: number) =>
    tx.pTRHistory.create({
      data: {
        playerId: p.id,
        matchId,
        ptrBefore: p.ptr,
        ptrAfter: p.ptr + delta,
        delta,
        reliability: calculateReliability(p.matchesPlayed + 1),
      },
    })

  await Promise.all([
    updatePlayer(p1, dA1, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
    updatePlayer(p2, dA2, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
    updatePlayer(p3, dB1, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
    updatePlayer(p4, dB2, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
    ptrHistory(p1, dA1), ptrHistory(p2, dA2),
    ptrHistory(p3, dB1), ptrHistory(p4, dB2),
    tx.match.update({
      where: { id: matchId },
      data: {
        status: 'complete',
        winner,
        teamAPTRAfter: teamAPTRBefore + result.teamADelta,
        teamBPTRAfter: teamBPTRBefore + result.teamBDelta,
        ptrDelta: Math.abs(result.teamADelta),
        scoreMultiplier: result.scoreMultiplier,
        isUpset: result.isUpset,
        matchQuality: result.matchQuality,
      },
    }),
  ])

  return { ptrDelta: Math.abs(result.teamADelta), isUpset: result.isUpset }
}
