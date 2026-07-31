import { getMatches, getPlayers } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'
import { listOnePointEvents } from '@/lib/one-point-store'
import AdminPanel from '@/components/admin/AdminPanel'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const [matches, americanoEvents, roundRobinEvents, onePointEvents, players] = await Promise.all([
    getMatches(),
    listAmericanoEvents(),
    listRoundRobinEvents(),
    listOnePointEvents(),
    getPlayers(),
  ])
  return (
    <AdminPanel
      matches={matches as MatchWithPlayers[]}
      americanoEvents={americanoEvents}
      roundRobinEvents={roundRobinEvents}
      onePointEvents={onePointEvents}
      players={players}
    />
  )
}
