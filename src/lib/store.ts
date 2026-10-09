import { prisma } from './prisma'
import {
  calculatePTRChanges,
  calculateReliability,
} from './ptr-algorithm'
import { listAmericanoEvents } from './americano-store'
import { listRoundRobinEvents } from './round-robin-store'
import { listOnePointEvents } from './one-point-store'
import { listSnakeLaddersEvents } from './snake-ladders-store'
import type { PlayerWithStats, MatchWithPlayers, PTRHistoryPoint } from '@/types'
import type { Player, PlayerSeason, PTRHistory, Season, Prisma } from '@prisma/client'

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

function toPlayerWithStats(p: PlayerWithHistory, ps: PlayerSeason, rank: number): PlayerWithStats {
  const history = [...p.ptrHistory].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatarColor: p.avatarColor,
    ptr: ps.ptr,
    reliability: ps.reliability,
    matchesPlayed: ps.matchesPlayed,
    wins: ps.wins,
    losses: ps.losses,
    setsWon: ps.setsWon,
    setsLost: ps.setsLost,
    gamesWon: ps.gamesWon,
    gamesLost: ps.gamesLost,
    tiebreaksWon: ps.tiebreaksWon,
    tiebreaksPlayed: ps.tiebreaksPlayed,
    currentStreak: ps.currentStreak,
    bestStreak: ps.bestStreak,
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

// Used to hydrate players embedded in a match/event for a specific season
// (e.g. the four players on a Match). `ps` is undefined only defensively —
// every player on a season's match/event always has a PlayerSeason row for
// that season, since you can only play while on that season's roster.
function toPlayerStub(p: Player, ps: PlayerSeason | undefined): PlayerWithStats {
  return {
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    avatarColor: p.avatarColor,
    ptr: ps?.ptr ?? 1000,
    reliability: ps?.reliability ?? 0,
    matchesPlayed: ps?.matchesPlayed ?? 0,
    wins: ps?.wins ?? 0,
    losses: ps?.losses ?? 0,
    setsWon: ps?.setsWon ?? 0,
    setsLost: ps?.setsLost ?? 0,
    gamesWon: ps?.gamesWon ?? 0,
    gamesLost: ps?.gamesLost ?? 0,
    tiebreaksWon: ps?.tiebreaksWon ?? 0,
    tiebreaksPlayed: ps?.tiebreaksPlayed ?? 0,
    currentStreak: ps?.currentStreak ?? 0,
    bestStreak: ps?.bestStreak ?? 0,
    ptrHistory: [],
    rank: 0,
    ptrDelta: 0,
  }
}

function hydrateMatch(m: MatchFull, psById: Map<string, PlayerSeason>): MatchWithPlayers {
  return {
    id: m.id,
    playedAt: m.playedAt.toISOString(),
    status: m.status as 'complete' | 'incomplete',
    isRanked: m.isRanked,
    winner: m.winner as 'A' | 'B' | null,
    teamAPlayer1Id: m.teamAPlayer1Id,
    teamAPlayer2Id: m.teamAPlayer2Id,
    teamBPlayer1Id: m.teamBPlayer1Id,
    teamBPlayer2Id: m.teamBPlayer2Id,
    teamAPlayer1: toPlayerStub(m.teamAPlayer1, psById.get(m.teamAPlayer1Id)),
    teamAPlayer2: toPlayerStub(m.teamAPlayer2, psById.get(m.teamAPlayer2Id)),
    teamBPlayer1: toPlayerStub(m.teamBPlayer1, psById.get(m.teamBPlayer1Id)),
    teamBPlayer2: toPlayerStub(m.teamBPlayer2, psById.get(m.teamBPlayer2Id)),
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

async function playerSeasonMap(seasonId: string, playerIds: string[]): Promise<Map<string, PlayerSeason>> {
  const rows = await prisma.playerSeason.findMany({
    where: { seasonId, playerId: { in: Array.from(new Set(playerIds)) } },
  })
  return new Map(rows.map(ps => [ps.playerId, ps]))
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

const NEW_PLAYER_COLORS = ['#00ff87', '#00d4ff', '#a855f7', '#ff6b35', '#fbbf24', '#f472b6', '#34d399', '#60a5fa']

export async function getActiveSeason(): Promise<Season | null> {
  return prisma.season.findFirst({ where: { status: 'active' } })
}

export async function listSeasons(): Promise<Season[]> {
  return prisma.season.findMany({ orderBy: { startedAt: 'desc' } })
}

export async function getSeason(id: string): Promise<Season | null> {
  return prisma.season.findUnique({ where: { id } })
}

// Every player identity ever created, regardless of which seasons they've
// played in — used to build the roster checklist when starting a new
// season (a player can be carried over even if they sat out the most
// recent season).
export async function listAllPlayers(): Promise<Player[]> {
  return prisma.player.findMany({ orderBy: { createdAt: 'asc' } })
}

// Every write path against season-scoped data (matches, event scores,
// deletes) calls this first — the single place that makes "closed = fully
// locked" airtight, rather than scattering status checks everywhere.
export async function assertSeasonActive(seasonId: string): Promise<{ ok: true } | { error: string }> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  if (!season) return { error: 'Season not found' }
  if (season.status !== 'active') return { error: 'This season is closed' }
  return { ok: true }
}

export async function closeSeason(id: string): Promise<{ ok: true } | { error: string }> {
  const season = await prisma.season.findUnique({ where: { id } })
  if (!season) return { error: 'Season not found' }
  if (season.status !== 'active') return { error: 'Season is not active' }
  await prisma.season.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } })
  return { ok: true }
}

// Admin-only, and only when no other season is currently active — keeps
// "at most one active season" true at all times.
export async function reopenSeason(id: string): Promise<{ ok: true } | { error: string }> {
  const season = await prisma.season.findUnique({ where: { id } })
  if (!season) return { error: 'Season not found' }
  if (season.status !== 'closed') return { error: 'Season is not closed' }
  const activeCount = await prisma.season.count({ where: { status: 'active' } })
  if (activeCount > 0) return { error: 'Close the current active season first' }
  await prisma.season.update({ where: { id }, data: { status: 'active', closedAt: null } })
  return { ok: true }
}

// Permanently removes a closed season and everything scoped to it —
// matches, events, PTR history and per-season player stats. Player
// identities survive (they may belong to other seasons, and can be carried
// into future ones). Active seasons must be closed first, so a live season
// can never disappear mid-play.
export async function deleteSeason(id: string): Promise<{ ok: true } | { error: string }> {
  const season = await prisma.season.findUnique({ where: { id } })
  if (!season) return { error: 'Season not found' }
  if (season.status !== 'closed') return { error: 'Close the season before deleting it' }

  await prisma.$transaction([
    // PTR history references matches and events, so it goes first.
    prisma.pTRHistory.deleteMany({ where: { seasonId: id } }),
    prisma.match.deleteMany({ where: { seasonId: id } }), // sets cascade
    prisma.americanoEvent.deleteMany({ where: { seasonId: id } }), // event matches cascade
    prisma.roundRobinEvent.deleteMany({ where: { seasonId: id } }),
    prisma.onePointEvent.deleteMany({ where: { seasonId: id } }),
    prisma.snakeLaddersEvent.deleteMany({ where: { seasonId: id } }),
    prisma.playerSeason.deleteMany({ where: { seasonId: id } }),
    prisma.season.delete({ where: { id } }),
  ])
  return { ok: true }
}

// A season's roster is fixed for its whole lifetime — there's no
// add/remove-player action against an active season, same as before
// seasons existed. New player identities can only be introduced here,
// alongside carrying over existing players, when the season is created.
export async function startNewSeason(data: {
  name: string
  location: string
  carryOverPlayerIds: string[]
  newPlayers: { name: string; nickname?: string; avatarColor?: string }[]
}): Promise<{ id: string } | { error: string }> {
  if (!data.name.trim()) return { error: 'Season year is required' }
  if (!data.location.trim()) return { error: 'Season location is required' }
  const activeCount = await prisma.season.count({ where: { status: 'active' } })
  if (activeCount > 0) return { error: 'Close the current season before starting a new one' }
  if (data.carryOverPlayerIds.length === 0 && data.newPlayers.length === 0) {
    return { error: 'Select at least one player' }
  }

  return prisma.$transaction(async tx => {
    const season = await tx.season.create({ data: { name: data.name.trim(), location: data.location.trim(), status: 'active' } })

    const newPlayerRows = await Promise.all(
      data.newPlayers.map((np, i) => tx.player.create({
        data: {
          name: np.name,
          nickname: np.nickname || null,
          avatarColor: np.avatarColor ?? NEW_PLAYER_COLORS[i % NEW_PLAYER_COLORS.length],
        },
      }))
    )

    const rosterIds = [...data.carryOverPlayerIds, ...newPlayerRows.map(p => p.id)]
    await tx.playerSeason.createMany({ data: rosterIds.map(playerId => ({ playerId, seasonId: season.id })) })

    return { id: season.id }
  })
}

// ---------------------------------------------------------------------------
// Player queries (season-scoped; defaults to the active season)
// ---------------------------------------------------------------------------

// Resolves a season id, falling back to the active season. Returns null
// only when no seasonId was given AND there's currently no active season
// (the brief window between closing one season and starting the next) —
// every caller below treats that as "nothing to show" rather than erroring.
async function resolveSeasonId(seasonId?: string): Promise<string | null> {
  if (seasonId) return seasonId
  const active = await getActiveSeason()
  return active?.id ?? null
}

export async function getPlayers(seasonId?: string): Promise<PlayerWithStats[]> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return []
  const rows = await prisma.playerSeason.findMany({
    where: { seasonId: sid },
    include: { player: { include: { ptrHistory: { where: { seasonId: sid } } } } },
    orderBy: { ptr: 'desc' },
  })
  return rows.map((row, i) => toPlayerWithStats(row.player, row, i + 1))
}

export async function getPlayer(id: string, seasonId?: string): Promise<PlayerWithStats | null> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return null
  const row = await prisma.playerSeason.findUnique({
    where: { playerId_seasonId: { playerId: id, seasonId: sid } },
    include: { player: { include: { ptrHistory: { where: { seasonId: sid } } } } },
  })
  if (!row) return null
  return toPlayerWithStats(row.player, row, 0)
}

// Raw (unshaped) current-season stats for a player — used by the PTR
// preview endpoint, which only needs `.ptr`/`.matchesPlayed`.
export async function getPlayerRaw(id: string, seasonId?: string): Promise<PlayerSeason | null> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return null
  return prisma.playerSeason.findUnique({ where: { playerId_seasonId: { playerId: id, seasonId: sid } } })
}

// ---------------------------------------------------------------------------
// Match queries (season-scoped; defaults to the active season)
// ---------------------------------------------------------------------------

export async function getMatches(seasonId?: string): Promise<MatchWithPlayers[]> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return []
  const matches = await prisma.match.findMany({
    where: { seasonId: sid },
    include: MATCH_INCLUDE,
    orderBy: { playedAt: 'desc' },
  })
  const playerIds = matches.flatMap(m => [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id])
  const psById = await playerSeasonMap(sid, playerIds)
  return matches.map(m => hydrateMatch(m, psById))
}

export async function getMatchById(id: string): Promise<MatchWithPlayers | null> {
  const m = await prisma.match.findUnique({ where: { id }, include: MATCH_INCLUDE })
  if (!m) return null
  const psById = await playerSeasonMap(m.seasonId, [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id])
  return hydrateMatch(m, psById)
}

export async function getMatchCount(seasonId?: string): Promise<number> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return 0
  return prisma.match.count({ where: { seasonId: sid } })
}

export async function getEventCount(seasonId?: string): Promise<number> {
  const sid = await resolveSeasonId(seasonId)
  if (!sid) return 0
  const [americanoCount, roundRobinCount, onePointCount, snakeLaddersCount] = await Promise.all([
    prisma.americanoEvent.count({ where: { seasonId: sid } }),
    prisma.roundRobinEvent.count({ where: { seasonId: sid } }),
    prisma.onePointEvent.count({ where: { seasonId: sid } }),
    prisma.snakeLaddersEvent.count({ where: { seasonId: sid } }),
  ])
  return americanoCount + roundRobinCount + onePointCount + snakeLaddersCount
}

// Event wins across every format: for Americano and Round Robin, whoever
// tops that event's points leaderboard gets credit (ties all count, since
// neither format has a tiebreaker — Round Robin credits both players on a
// tied winning team); for One Point, only the tournament champion counts,
// since single elimination has no ties; for Snake and Ladders, both
// players of the final round's top-court winning pair count. Used for the
// "Eventist" award and player profile stat. Season-scoped like everything
// else, defaulting to the active season.
export async function getEventWinCounts(seasonId?: string): Promise<Map<string, number>> {
  const sid = await resolveSeasonId(seasonId)
  const wins = new Map<string, number>()
  if (!sid) return wins
  const credit = (playerId: string) => wins.set(playerId, (wins.get(playerId) ?? 0) + 1)

  const [americanoEvents, roundRobinEvents, onePointEvents, snakeLaddersEvents] = await Promise.all([
    listAmericanoEvents(sid),
    listRoundRobinEvents(sid),
    listOnePointEvents(sid),
    listSnakeLaddersEvents(sid),
  ])

  for (const event of americanoEvents) {
    if (event.status !== 'complete' || event.leaderboard.length === 0) continue
    const topScore = event.leaderboard[0].points
    if (topScore <= 0) continue
    for (const row of event.leaderboard) {
      if (row.points === topScore) credit(row.playerId)
    }
  }

  for (const event of roundRobinEvents) {
    if (event.status !== 'complete' || event.leaderboard.length === 0) continue
    const topScore = event.leaderboard[0].points
    if (topScore <= 0) continue
    for (const row of event.leaderboard) {
      if (row.points === topScore) row.playerIds.forEach(credit)
    }
  }

  for (const event of onePointEvents) {
    if (event.status === 'complete' && event.championId) credit(event.championId)
  }

  for (const event of snakeLaddersEvents) {
    if (event.status === 'complete' && event.firstPlaceIds) event.firstPlaceIds.forEach(credit)
  }

  return wins
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
  isRanked?: boolean
}): Promise<{ matchId: string; ptrDelta: number; isUpset: boolean; status: string } | { error: string }> {
  const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner, status } = data
  const isRanked = data.isRanked ?? true

  const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
  if (new Set(ids).size !== 4) return { error: 'All four players must be different' }

  const season = await getActiveSeason()
  if (!season) return { error: 'No active season' }
  const psById = await playerSeasonMap(season.id, ids)
  const [ps1, ps2, ps3, ps4] = ids.map(id => psById.get(id))
  if (!ps1 || !ps2 || !ps3 || !ps4) return { error: 'One or more players are not in the current season' }

  const teamAPTRBefore = (ps1.ptr + ps2.ptr) / 2
  const teamBPTRBefore = (ps3.ptr + ps4.ptr) / 2

  if (status === 'complete' && winner) {
    return prisma.$transaction(async tx => {
      const match = await tx.match.create({
        data: {
          status,
          isRanked,
          seasonId: season.id,
          teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
          teamAPTRBefore, teamBPTRBefore,
          teamAPTRAfter: teamAPTRBefore,
          teamBPTRAfter: teamBPTRBefore,
          sets: { create: sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })) },
        },
      })
      const result = await applyPTR(tx, match.id, season.id, { ps1, ps2, ps3, ps4 }, sets, winner, teamAPTRBefore, teamBPTRBefore, isRanked)
      return { matchId: match.id, ptrDelta: result.ptrDelta, isUpset: result.isUpset, status }
    })
  }

  const match = await prisma.match.create({
    data: {
      status: 'incomplete',
      isRanked,
      seasonId: season.id,
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
  const seasonCheck = await assertSeasonActive(match.seasonId)
  if ('error' in seasonCheck) return seasonCheck

  if (status === 'complete' && winner) {
    const ids = [match.teamAPlayer1Id, match.teamAPlayer2Id, match.teamBPlayer1Id, match.teamBPlayer2Id]
    const psById = await playerSeasonMap(match.seasonId, ids)
    const [ps1, ps2, ps3, ps4] = ids.map(id => psById.get(id))
    if (!ps1 || !ps2 || !ps3 || !ps4) return { error: 'Player not found' }

    await prisma.$transaction(async tx => {
      // Replace sets
      await tx.matchSet.deleteMany({ where: { matchId: id } })
      await tx.matchSet.createMany({
        data: sets.map((s, i) => ({ matchId: id, setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })),
      })
      await applyPTR(tx, id, match.seasonId, { ps1, ps2, ps3, ps4 }, sets, winner, match.teamAPTRBefore, match.teamBPTRBefore, match.isRanked)
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
// Player update (identity only — nickname/avatar; never stats)
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
    const season = await tx.season.findUnique({ where: { id: match.seasonId } })
    if (!season || season.status !== 'active') return { error: 'This season is closed' }

    if (match.status === 'complete' && match.winner) {
      const ids = [match.teamAPlayer1Id, match.teamAPlayer2Id, match.teamBPlayer1Id, match.teamBPlayer2Id]
      const psRows = await tx.playerSeason.findMany({ where: { seasonId: match.seasonId, playerId: { in: ids } } })
      const psById = new Map(psRows.map(ps => [ps.playerId, ps]))
      const [ps1, ps2, ps3, ps4] = ids.map(id => psById.get(id))
      if (!ps1 || !ps2 || !ps3 || !ps4) return { error: 'Player not found' }

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

      const reversePlayerSeason = (ps: PlayerSeason, isWinner: boolean, sw: number, sl: number, gw: number, gl: number, tbWon: number) => {
        const newMatches = Math.max(0, ps.matchesPlayed - 1)
        return tx.playerSeason.update({
          where: { playerId_seasonId: { playerId: ps.playerId, seasonId: match.seasonId } },
          data: {
            ptr: ps.ptr - getDelta(ps.playerId),
            matchesPlayed: newMatches,
            reliability: calculateReliability(newMatches),
            wins: isWinner ? Math.max(0, ps.wins - 1) : ps.wins,
            losses: isWinner ? ps.losses : Math.max(0, ps.losses - 1),
            setsWon: Math.max(0, ps.setsWon - sw),
            setsLost: Math.max(0, ps.setsLost - sl),
            gamesWon: Math.max(0, ps.gamesWon - gw),
            gamesLost: Math.max(0, ps.gamesLost - gl),
            tiebreaksWon: Math.max(0, ps.tiebreaksWon - tbWon),
            tiebreaksPlayed: Math.max(0, ps.tiebreaksPlayed - tbTotal),
            currentStreak: 0,
          },
        })
      }

      await Promise.all([
        reversePlayerSeason(ps1, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
        reversePlayerSeason(ps2, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
        reversePlayerSeason(ps3, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
        reversePlayerSeason(ps4, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
      ])
    }

    await tx.pTRHistory.deleteMany({ where: { matchId: id } })
    await tx.matchSet.deleteMany({ where: { matchId: id } })
    await tx.match.delete({ where: { id } })
    return { ok: true as const }
  })
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
  seasonId: string,
  players: { ps1: PlayerSeason; ps2: PlayerSeason; ps3: PlayerSeason; ps4: PlayerSeason },
  sets: { teamAGames: number; teamBGames: number }[],
  winner: 'A' | 'B',
  teamAPTRBefore: number,
  teamBPTRBefore: number,
  isRanked: boolean,
): Promise<{ ptrDelta: number; isUpset: boolean }> {
  const { ps1, ps2, ps3, ps4 } = players

  const result = calculatePTRChanges(
    [ps1.ptr, ps2.ptr],
    [ps3.ptr, ps4.ptr],
    [calculateReliability(ps1.matchesPlayed), calculateReliability(ps2.matchesPlayed)],
    [calculateReliability(ps3.matchesPlayed), calculateReliability(ps4.matchesPlayed)],
    sets.map((s, i) => ({ setNumber: i + 1, ...s })),
    winner,
  )

  // Unranked matches still update stats/streaks/tiebreaks normally — only
  // the actual PTR movement is suppressed, by zeroing every delta below.
  const rankMultiplier = isRanked ? 1 : 0

  const playedSets = sets.filter(s => s.teamAGames + s.teamBGames > 0)
  const setsA = playedSets.filter(s => s.teamAGames > s.teamBGames).length
  const setsB = playedSets.filter(s => s.teamBGames > s.teamAGames).length
  const gamesA = playedSets.reduce((acc, s) => acc + s.teamAGames, 0)
  const gamesB = playedSets.reduce((acc, s) => acc + s.teamBGames, 0)

  const tbWonA = sets.filter(s => s.teamAGames === 7 && s.teamBGames === 6).length
  const tbWonB = sets.filter(s => s.teamBGames === 7 && s.teamAGames === 6).length
  const tbTotal = tbWonA + tbWonB

  const dA1 = result.playerADeltas[0] * rankMultiplier
  const dA2 = result.playerADeltas[1] * rankMultiplier
  const dB1 = result.playerBDeltas[0] * rankMultiplier
  const dB2 = result.playerBDeltas[1] * rankMultiplier
  const teamADelta = result.teamADelta * rankMultiplier
  const teamBDelta = result.teamBDelta * rankMultiplier

  const updatePlayerSeason = (ps: PlayerSeason, delta: number, isWinner: boolean, sw: number, sl: number, gw: number, gl: number, tbWon: number) => {
    const newMatches = ps.matchesPlayed + 1
    const newStreak = isWinner
      ? (ps.currentStreak > 0 ? ps.currentStreak + 1 : 1)
      : (ps.currentStreak < 0 ? ps.currentStreak - 1 : -1)
    return tx.playerSeason.update({
      where: { playerId_seasonId: { playerId: ps.playerId, seasonId } },
      data: {
        ptr: ps.ptr + delta,
        matchesPlayed: newMatches,
        reliability: calculateReliability(newMatches),
        wins: isWinner ? ps.wins + 1 : ps.wins,
        losses: isWinner ? ps.losses : ps.losses + 1,
        setsWon: ps.setsWon + sw,
        setsLost: ps.setsLost + sl,
        gamesWon: ps.gamesWon + gw,
        gamesLost: ps.gamesLost + gl,
        tiebreaksWon: ps.tiebreaksWon + tbWon,
        tiebreaksPlayed: ps.tiebreaksPlayed + tbTotal,
        currentStreak: newStreak,
        bestStreak: isWinner ? Math.max(ps.bestStreak, newStreak) : ps.bestStreak,
      },
    })
  }

  const ptrHistory = (ps: PlayerSeason, delta: number) =>
    tx.pTRHistory.create({
      data: {
        playerId: ps.playerId,
        matchId,
        seasonId,
        ptrBefore: ps.ptr,
        ptrAfter: ps.ptr + delta,
        delta,
        reliability: calculateReliability(ps.matchesPlayed + 1),
      },
    })

  await Promise.all([
    updatePlayerSeason(ps1, dA1, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
    updatePlayerSeason(ps2, dA2, winner === 'A', setsA, setsB, gamesA, gamesB, tbWonA),
    updatePlayerSeason(ps3, dB1, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
    updatePlayerSeason(ps4, dB2, winner === 'B', setsB, setsA, gamesB, gamesA, tbWonB),
    ptrHistory(ps1, dA1), ptrHistory(ps2, dA2),
    ptrHistory(ps3, dB1), ptrHistory(ps4, dB2),
    tx.match.update({
      where: { id: matchId },
      data: {
        status: 'complete',
        winner,
        teamAPTRAfter: teamAPTRBefore + teamADelta,
        teamBPTRAfter: teamBPTRBefore + teamBDelta,
        ptrDelta: Math.abs(teamADelta),
        scoreMultiplier: result.scoreMultiplier,
        isUpset: result.isUpset,
        matchQuality: result.matchQuality,
      },
    }),
  ])

  return { ptrDelta: Math.abs(teamADelta), isUpset: result.isUpset }
}
