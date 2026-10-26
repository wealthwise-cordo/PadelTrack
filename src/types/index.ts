export interface PlayerWithStats {
  id: string
  name: string
  nickname: string | null
  avatarColor: string
  isGuest: boolean
  // A guest the super user verified: rated, but not in circles or rankings.
  isRankedGuest: boolean
  // Account deleted: still named in past matches, but no profile page.
  isDeleted: boolean
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
  ptrDelta?: number // change from their last match (adjustments don't count)
}

export interface PTRHistoryPoint {
  id: string
  ptrBefore: number
  ptrAfter: number
  delta: number
  reliability: number
  createdAt: string
  matchId?: string | null
  // A manual rating adjustment rather than a match: it recalibrates the
  // rating but isn't movement, so stats and "last change" figures skip it.
  isAdjustment?: boolean
}

export interface MatchSet {
  setNumber: number
  teamAGames: number
  teamBGames: number
}

export interface ScoreReport {
  id: string
  submittedBy: string
  // The submitter's pair.
  side: 'A' | 'B' | null
  sets: MatchSet[]
  winner: 'A' | 'B' | null
  incomplete: boolean
  status: 'open' | 'accepted' | 'rejected'
}

export interface MatchWithPlayers {
  id: string
  // For a scheduled match: its start time.
  playedAt: string
  status: 'scheduled' | 'pending' | 'complete'
  // Set up in advance by this user (scheduled matches only).
  organiserId: string | null
  // Two different scores were entered; waiting for a player to pick one.
  disputed: boolean
  scoreReports: ScoreReport[]
  isRanked: boolean
  recordedById: string
  submittedAt: string
  location: string | null
  clubId: string | null
  // When a pending match will confirm itself if no opponent acts.
  autoConfirmAt: string
  autoConfirmed: boolean
  scoreConfirmed: boolean
  becameFriendly: boolean
  // Players in the match who aren't on PadelTrack yet. The claim token (for
  // the invite link) is only included in the viewer's own Match Centre.
  // ranked: a ranked guest, so the match doesn't wait for them to join.
  guests: { id: string; name: string; ranked: boolean; claimToken?: string }[]
  // A pending match confirms itself after 48 hours only if someone (an
  // opponent, or the partner) could have confirmed it.
  autoConfirms: boolean
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
  // Null when the match didn't finish (incomplete).
  winner: 'A' | 'B' | null
  incomplete: boolean
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

// One confirmed match from a single player's point of view, used by the
// profile's time-range toggle.
export interface ProfileMatch {
  id: string
  playedAt: string
  won: boolean
  setsFor: number
  setsAgainst: number
  gamesFor: number
  gamesAgainst: number
  delta: number
  opponents: string
  // Didn't finish: counts towards sets and games only.
  incomplete?: boolean
}
