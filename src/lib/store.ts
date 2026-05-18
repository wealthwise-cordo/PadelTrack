/**
 * In-memory data store — no database required.
 * Pre-seeded with 8 players. Data resets on cold start.
 * Swap this module for the Prisma-backed version once a database is provisioned.
 */
import bcrypt from 'bcryptjs'
import {
  calculatePTRChanges,
  calculateReliability,
  calculateMatchQuality,
  isUpset as checkUpset,
} from './ptr-algorithm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredUser {
  id: string
  email: string
  password: string
  name: string
}

export interface StoredPTRHistory {
  id: string
  playerId: string
  matchId: string | null
  ptrBefore: number
  ptrAfter: number
  delta: number
  reliability: number
  createdAt: string
}

export interface StoredSet {
  setNumber: number
  teamAGames: number
  teamBGames: number
}

export interface StoredMatch {
  id: string
  playedAt: string
  submittedAt: string
  status: 'complete' | 'incomplete'
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  winner: 'A' | 'B' | null
  teamAPTRBefore: number
  teamBPTRBefore: number
  teamAPTRAfter: number
  teamBPTRAfter: number
  ptrDelta: number
  scoreMultiplier: number
  isUpset: boolean
  matchQuality: number
  notes: string | null
  sets: StoredSet[]
}

export interface StoredPlayer {
  id: string
  userId: string
  name: string
  nickname: string
  avatarColor: string
  ptr: number
  reliability: number
  matchesPlayed: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  gamesWon: number
  gamesLost: number
  tiebreaksWon: number
  tiebreaksPlayed: number
  currentStreak: number
  bestStreak: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const COLORS = ['#00ff87', '#00d4ff', '#a855f7', '#ff6b35', '#fbbf24', '#f472b6', '#34d399', '#60a5fa']

const SEED = [
  { name: 'Cord van Eck',      nickname: 'Green Mamba' },
  { name: 'JonJon Clark',      nickname: 'Double J'    },
  { name: 'Zac Schmidt',       nickname: 'The Hammer'  },
  { name: 'Brandon Fair',      nickname: 'Fairway'     },
  { name: 'Cameron Meek',      nickname: 'Cam Bam'     },
  { name: 'Ashley Butler',     nickname: 'Red Mist'    },
  { name: 'Alex Messeguer',    nickname: 'The Tornado' },
  { name: 'Jason Knibbs',      nickname: 'Knibster'    },
]

const PW_HASH = bcrypt.hashSync('password123', 10)

function buildSeedState() {
  const users: StoredUser[] = SEED.map((s, i) => ({
    id: `user_${i + 1}`,
    email: s.name.toLowerCase().replace(' ', '.') + '@ptr.com',
    password: PW_HASH,
    name: s.name,
  }))

  const players: StoredPlayer[] = SEED.map((s, i) => ({
    id: `player_${i + 1}`,
    userId: `user_${i + 1}`,
    name: s.name,
    nickname: s.nickname,
    avatarColor: COLORS[i],
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  return { users, players }
}

// ---------------------------------------------------------------------------
// Mutable singleton state
// ---------------------------------------------------------------------------

const { users: USERS, players: PLAYERS } = buildSeedState()

let _players: StoredPlayer[] = PLAYERS
let _matches: StoredMatch[] = []
let _ptrHistory: StoredPTRHistory[] = []

function uid() {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Player queries
// ---------------------------------------------------------------------------

export function getPlayers() {
  const sorted = [..._players].sort((a, b) => b.ptr - a.ptr)
  return sorted.map((p, i) => {
    const history = _ptrHistory
      .filter(h => h.playerId === p.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const lastDelta = history.length > 0 ? history[history.length - 1].delta : 0
    return { ...p, rank: i + 1, ptrDelta: lastDelta, ptrHistory: history }
  })
}

export function getPlayer(id: string) {
  const p = _players.find(p => p.id === id)
  if (!p) return null
  const history = _ptrHistory
    .filter(h => h.playerId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return { ...p, ptrHistory: history }
}

export function getPlayerRaw(id: string) {
  return _players.find(p => p.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Match queries
// ---------------------------------------------------------------------------

function hydrate(m: StoredMatch) {
  const pA1 = _players.find(p => p.id === m.teamAPlayer1Id)!
  const pA2 = _players.find(p => p.id === m.teamAPlayer2Id)!
  const pB1 = _players.find(p => p.id === m.teamBPlayer1Id)!
  const pB2 = _players.find(p => p.id === m.teamBPlayer2Id)!
  return {
    ...m,
    teamAPlayer1: { ...pA1, ptrHistory: [], rank: 0, ptrDelta: 0 },
    teamAPlayer2: { ...pA2, ptrHistory: [], rank: 0, ptrDelta: 0 },
    teamBPlayer1: { ...pB1, ptrHistory: [], rank: 0, ptrDelta: 0 },
    teamBPlayer2: { ...pB2, ptrHistory: [], rank: 0, ptrDelta: 0 },
  }
}

export function getMatches() {
  return [..._matches]
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .map(hydrate)
}

export function getMatchCount() {
  return _matches.length
}

// ---------------------------------------------------------------------------
// Match creation (all PTR logic lives here)
// ---------------------------------------------------------------------------

function applyPTR(
  match: StoredMatch,
  winner: 'A' | 'B',
  now: string
) {
  const p1 = _players.find(p => p.id === match.teamAPlayer1Id)!
  const p2 = _players.find(p => p.id === match.teamAPlayer2Id)!
  const p3 = _players.find(p => p.id === match.teamBPlayer1Id)!
  const p4 = _players.find(p => p.id === match.teamBPlayer2Id)!

  const sets = match.sets.map(s => ({ teamAGames: s.teamAGames, teamBGames: s.teamBGames }))
  const playedSets = sets.filter(s => s.teamAGames + s.teamBGames > 0)

  const result = calculatePTRChanges(
    [p1.ptr, p2.ptr],
    [p3.ptr, p4.ptr],
    [calculateReliability(p1.matchesPlayed), calculateReliability(p2.matchesPlayed)],
    [calculateReliability(p3.matchesPlayed), calculateReliability(p4.matchesPlayed)],
    match.sets,
    winner
  )

  const setsA = playedSets.filter(s => s.teamAGames > s.teamBGames).length
  const setsB = playedSets.filter(s => s.teamBGames > s.teamAGames).length
  const gamesA = playedSets.reduce((acc, s) => acc + s.teamAGames, 0)
  const gamesB = playedSets.reduce((acc, s) => acc + s.teamBGames, 0)

  Object.assign(match, {
    winner,
    status: 'complete' as const,
    teamAPTRAfter: match.teamAPTRBefore + result.teamADelta,
    teamBPTRAfter: match.teamBPTRBefore + result.teamBDelta,
    ptrDelta: Math.abs(result.teamADelta),
    scoreMultiplier: result.scoreMultiplier,
    isUpset: result.isUpset,
    matchQuality: result.matchQuality,
  })

  const updatePlayer = (
    p: StoredPlayer,
    delta: number,
    isWinner: boolean,
    sw: number, sl: number, gw: number, gl: number
  ) => {
    const newMatches = p.matchesPlayed + 1
    const newStreak = isWinner
      ? (p.currentStreak > 0 ? p.currentStreak + 1 : 1)
      : (p.currentStreak < 0 ? p.currentStreak - 1 : -1)
    Object.assign(p, {
      ptr: p.ptr + delta,
      matchesPlayed: newMatches,
      reliability: calculateReliability(newMatches),
      wins: isWinner ? p.wins + 1 : p.wins,
      losses: isWinner ? p.losses : p.losses + 1,
      setsWon: p.setsWon + sw,
      setsLost: p.setsLost + sl,
      gamesWon: p.gamesWon + gw,
      gamesLost: p.gamesLost + gl,
      currentStreak: newStreak,
      bestStreak: isWinner ? Math.max(p.bestStreak, newStreak) : p.bestStreak,
      updatedAt: now,
    })
  }

  const [dA1, dA2] = result.playerADeltas
  const [dB1, dB2] = result.playerBDeltas

  updatePlayer(p1, dA1, winner === 'A', setsA, setsB, gamesA, gamesB)
  updatePlayer(p2, dA2, winner === 'A', setsA, setsB, gamesA, gamesB)
  updatePlayer(p3, dB1, winner === 'B', setsB, setsA, gamesB, gamesA)
  updatePlayer(p4, dB2, winner === 'B', setsB, setsA, gamesB, gamesA)

  const pushHistory = (p: StoredPlayer, ptrBefore: number, delta: number) => {
    _ptrHistory.push({ id: uid(), playerId: p.id, matchId: match.id, ptrBefore, ptrAfter: p.ptr, delta, reliability: p.reliability, createdAt: now })
  }
  pushHistory(p1, p1.ptr - dA1, dA1)
  pushHistory(p2, p2.ptr - dA2, dA2)
  pushHistory(p3, p3.ptr - dB1, dB1)
  pushHistory(p4, p4.ptr - dB2, dB2)

  // Tiebreak tracking (set score 7-6 either way)
  const tbWonA = match.sets.filter(s => s.teamAGames === 7 && s.teamBGames === 6).length
  const tbWonB = match.sets.filter(s => s.teamBGames === 7 && s.teamAGames === 6).length
  const tbTotal = tbWonA + tbWonB
  for (const p of [p1, p2]) { p.tiebreaksWon += tbWonA; p.tiebreaksPlayed += tbTotal }
  for (const p of [p3, p4]) { p.tiebreaksWon += tbWonB; p.tiebreaksPlayed += tbTotal }
}

export function createMatch(data: {
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  sets: { teamAGames: number; teamBGames: number }[]
  winner: 'A' | 'B' | null
  status: 'complete' | 'incomplete'
}): { matchId: string; ptrDelta: number; isUpset: boolean; status: string } | { error: string } {
  const { teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id, sets, winner, status } = data

  const ids = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id]
  if (new Set(ids).size !== 4) return { error: 'All four players must be different' }

  const p1 = _players.find(p => p.id === teamAPlayer1Id)
  const p2 = _players.find(p => p.id === teamAPlayer2Id)
  const p3 = _players.find(p => p.id === teamBPlayer1Id)
  const p4 = _players.find(p => p.id === teamBPlayer2Id)

  if (!p1 || !p2 || !p3 || !p4) return { error: 'One or more players not found' }

  const teamAPTRBefore = (p1.ptr + p2.ptr) / 2
  const teamBPTRBefore = (p3.ptr + p4.ptr) / 2
  const matchId = uid()
  const now = new Date().toISOString()

  const match: StoredMatch = {
    id: matchId,
    playedAt: now,
    submittedAt: now,
    status,
    teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id,
    winner: null,
    teamAPTRBefore,
    teamBPTRBefore,
    teamAPTRAfter: teamAPTRBefore,
    teamBPTRAfter: teamBPTRBefore,
    ptrDelta: 0,
    scoreMultiplier: 1,
    isUpset: false,
    matchQuality: 0,
    notes: null,
    sets: sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames })),
  }

  _matches.push(match)

  if (status === 'complete' && winner) {
    applyPTR(match, winner, now)
  }

  return { matchId, ptrDelta: match.ptrDelta, isUpset: match.isUpset, status }
}

export function updateMatch(
  id: string,
  sets: { teamAGames: number; teamBGames: number }[],
  winner: 'A' | 'B' | null,
  status: 'complete' | 'incomplete'
): { ok: true } | { error: string } {
  const match = _matches.find(m => m.id === id)
  if (!match) return { error: 'Match not found' }
  if (match.status === 'complete') return { error: 'Cannot edit a completed match' }

  match.sets = sets.map((s, i) => ({ setNumber: i + 1, teamAGames: s.teamAGames, teamBGames: s.teamBGames }))

  if (status === 'complete' && winner) {
    const now = new Date().toISOString()
    applyPTR(match, winner, now)
  } else {
    match.status = 'incomplete'
    match.winner = null
  }

  return { ok: true }
}

export function getMatchById(id: string) {
  const m = _matches.find(m => m.id === id)
  return m ? hydrate(m) : null
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function updatePlayer(
  id: string,
  data: { nickname?: string; avatarColor?: string }
): { ok: true } | { error: string } {
  const p = _players.find(p => p.id === id)
  if (!p) return { error: 'Player not found' }
  if (data.nickname !== undefined) p.nickname = data.nickname
  if (data.avatarColor !== undefined) p.avatarColor = data.avatarColor
  p.updatedAt = new Date().toISOString()
  return { ok: true }
}

export function findUserByEmail(email: string) {
  return USERS.find(u => u.email === email) ?? null
}
