export interface PlayerWithStats {
  id: string
  name: string
  nickname: string | null
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
  currentStreak: number
  bestStreak: number
  ptrHistory: PTRHistoryPoint[]
  rank?: number
  ptrDelta?: number // change since last match
}

export interface PTRHistoryPoint {
  id: string
  ptrBefore: number
  ptrAfter: number
  delta: number
  reliability: number
  createdAt: string
  matchId?: string | null
}

export interface MatchSet {
  setNumber: number
  teamAGames: number
  teamBGames: number
}

export interface MatchWithPlayers {
  id: string
  playedAt: string
  status: 'complete' | 'incomplete'
  teamAPlayer1: PlayerWithStats
  teamAPlayer2: PlayerWithStats
  teamBPlayer1: PlayerWithStats
  teamBPlayer2: PlayerWithStats
  winner: 'A' | 'B' | null
  teamAPTRBefore: number
  teamBPTRBefore: number
  teamAPTRAfter: number
  teamBPTRAfter: number
  ptrDelta: number
  scoreMultiplier: number
  isUpset: boolean
  matchQuality: number
  sets: MatchSet[]
}

export interface PTRCalculation {
  teamAAvgPTR: number
  teamBAvgPTR: number
  expectedWinProbA: number
  kFactor: number
  scoreMultiplier: number
  deltaIfAWins: number
  deltaIfBWins: number
}

export interface HeadToHead {
  opponentId: string
  opponentName: string
  opponentColor: string
  wins: number
  losses: number
  winRate: number
}
