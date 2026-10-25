import type { MatchWithPlayers } from '@/types'

// A scheduled match as the match form needs it: you first, then your partner,
// then the opponents — with `flipped` set when you're on the match's B side,
// so the form can turn your-side scores back into A v B.
export function formExisting(m: MatchWithPlayers, myPlayerId: string) {
  const onB = m.teamBPlayer1Id === myPlayerId || m.teamBPlayer2Id === myPlayerId
  const mine = onB ? [m.teamBPlayer1Id, m.teamBPlayer2Id] : [m.teamAPlayer1Id, m.teamAPlayer2Id]
  const theirs = onB ? [m.teamAPlayer1Id, m.teamAPlayer2Id] : [m.teamBPlayer1Id, m.teamBPlayer2Id]
  const partner = mine.find(id => id !== myPlayerId)!
  return {
    matchId: m.id,
    slots: [myPlayerId, partner, theirs[0], theirs[1]] as [string, string, string, string],
    flipped: onB,
    startsAt: m.playedAt,
    location: m.location ? { clubId: m.clubId, label: m.location } : null,
    isRanked: m.isRanked,
  }
}
