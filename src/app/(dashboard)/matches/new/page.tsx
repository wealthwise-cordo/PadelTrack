import MatchEntryForm, { type Lineup } from '@/components/matches/MatchEntryForm'
import { getPickablePlayers, getPlayer, getMatchesForPlayer, getRecentLocations } from '@/lib/store'
import { requireSession } from '@/lib/session'

export const revalidate = 0

export default async function NewMatchPage() {
  const session = await requireSession()
  const meId = session.player.id
  const [me, pickable, myMatches, locations] = await Promise.all([
    getPlayer(meId),
    getPickablePlayers(session.userId),
    getMatchesForPlayer(meId),
    getRecentLocations(meId),
  ])

  // Who you play with most, from your last 50 matches, so the quick-pick
  // chips put the likeliest people first.
  const freq = new Map<string, number>()
  for (const m of myMatches.slice(0, 50)) {
    for (const id of [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]) {
      if (id !== meId) freq.set(id, (freq.get(id) ?? 0) + 1)
    }
  }
  const players = [...pickable].sort((a, b) =>
    a.id === meId ? -1 : b.id === meId ? 1 : (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.name.localeCompare(b.name)
  )

  // Your last few distinct line-ups (partner + the two opponents), for
  // one-tap "play again".
  const lineups: Lineup[] = []
  const seen = new Set<string>()
  for (const m of myMatches) {
    const onA = m.teamAPlayer1Id === meId || m.teamAPlayer2Id === meId
    const mine = onA ? [m.teamAPlayer1, m.teamAPlayer2] : [m.teamBPlayer1, m.teamBPlayer2]
    const opps = onA ? [m.teamBPlayer1, m.teamBPlayer2] : [m.teamAPlayer1, m.teamAPlayer2]
    const partner = mine.find(p => p.id !== meId)!
    const key = [partner.id, ...opps.map(o => o.id).sort()].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    lineups.push({ partner, opponents: [opps[0], opps[1]] })
    if (lineups.length === 3) break
  }

  return <MatchEntryForm me={me!} players={players} lineups={lineups} recentLocations={locations} />
}
