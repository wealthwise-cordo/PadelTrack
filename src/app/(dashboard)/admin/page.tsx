import { getMatches, getPlayers, getActiveSeason, listSeasons, listAllPlayers } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'
import { listOnePointEvents } from '@/lib/one-point-store'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'
import AdminPanel from '@/components/admin/AdminPanel'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const [activeSeason, seasons, allPlayers] = await Promise.all([
    getActiveSeason(),
    listSeasons(),
    listAllPlayers(),
  ])

  const sid = activeSeason?.id
  const [matches, americanoEvents, roundRobinEvents, onePointEvents, snakeLaddersEvents, players] = await Promise.all([
    sid ? getMatches(sid) : Promise.resolve([]),
    sid ? listAmericanoEvents(sid) : Promise.resolve([]),
    sid ? listRoundRobinEvents(sid) : Promise.resolve([]),
    sid ? listOnePointEvents(sid) : Promise.resolve([]),
    sid ? listSnakeLaddersEvents(sid) : Promise.resolve([]),
    sid ? getPlayers(sid) : Promise.resolve([]),
  ])

  // Pre-check the roster from the most recently closed season when
  // starting a new one — "everyone from last time" is the common case.
  const lastClosedSeason = seasons.find(s => s.status === 'closed')
  const lastSeasonPlayers = lastClosedSeason ? await getPlayers(lastClosedSeason.id) : []

  return (
    <AdminPanel
      // Forces a clean remount (resetting all local form/error state —
      // including the roster checklist default-check, which only applies
      // on mount) whenever the season situation actually changes.
      key={activeSeason?.id ?? `none-${lastClosedSeason?.id ?? 'empty'}`}
      activeSeason={activeSeason}
      seasons={seasons}
      allPlayers={allPlayers}
      lastSeasonPlayerIds={lastSeasonPlayers.map(p => p.id)}
      matches={matches as MatchWithPlayers[]}
      americanoEvents={americanoEvents}
      roundRobinEvents={roundRobinEvents}
      onePointEvents={onePointEvents}
      snakeLaddersEvents={snakeLaddersEvents}
      players={players}
    />
  )
}
