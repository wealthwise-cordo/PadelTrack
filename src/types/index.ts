export interface PlayerWithStats {
  id: string
  name: string
  nickname: string | null
  avatarColor: string
  isGuest: boolean
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
  status: 'pending' | 'complete'
  recordedById: string
  submittedAt: string
  // When a pending match will confirm itself if no opponent acts.
  autoConfirmAt: string
  autoConfirmed: boolean
  // The viewing player's rating change from this match, when known.
  viewerDelta?: number
  // For pending matches: first names of the opponents who can confirm.
  awaitingConfirmationFrom?: string[]
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
  teamAPlayer1: PlayerWithStats
  teamAPlayer2: PlayerWithStats
  teamBPlayer1: PlayerWithStats
  teamBPlayer2: PlayerWithStats
  winner: 'A' | 'B'
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
