// Fixed-team Round Robin scheduling for 3 or 4 teams on 1 court.
// Unlike Americano, partners never change — each team plays every other
// team exactly once. Matches are first-to-N games (not best-of), so a
// completed match has one team's score equal to the target and the other
// strictly below it.

export interface RoundRobinFixture {
  round: number
  teamAPlayer1Id: string
  teamAPlayer2Id: string
  teamBPlayer1Id: string
  teamBPlayer2Id: string
}

// Circle method with a bye slot for odd team counts: pads to an even
// number, runs the standard round-robin rotation, and drops any pairing
// that involves the bye. Produces exactly C(teamCount, 2) matches, each
// team facing every other team once.
function circleMethodTeamOrder(teamCount: number): [number, number][] {
  const BYE = -1
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1
  const ids = Array.from({ length: n }, (_, i) => (i < teamCount ? i : BYE))
  const fixed = ids[0]
  let rotating = ids.slice(1)
  const pairs: [number, number][] = []

  for (let r = 0; r < n - 1; r++) {
    const arranged = [fixed, ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = arranged[i]
      const b = arranged[n - 1 - i]
      if (a !== BYE && b !== BYE) pairs.push([a, b])
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)]
  }

  return pairs
}

// `teams` is an array of [player1Id, player2Id] pairs, one per team (3 or 4
// teams). Partners within a team are fixed for the whole event.
export function generateRoundRobinSchedule(teams: [string, string][]): RoundRobinFixture[] {
  const teamCount = teams.length
  if (teamCount !== 3 && teamCount !== 4) throw new Error('Round Robin supports 3 or 4 teams')

  const order = circleMethodTeamOrder(teamCount)
  return order.map(([a, b], i) => ({
    round: i + 1,
    teamAPlayer1Id: teams[a][0],
    teamAPlayer2Id: teams[a][1],
    teamBPlayer1Id: teams[b][0],
    teamBPlayer2Id: teams[b][1],
  }))
}
