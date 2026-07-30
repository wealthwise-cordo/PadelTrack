import { getMatches, getPlayers } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'
import AdminPanel from '@/components/admin/AdminPanel'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const [matches, americanoEvents, roundRobinEvents, players] = await Promise.all([
    getMatches(),
    listAmericanoEvents(),
    listRoundRobinEvents(),
    getPlayers(),
  ])
  return (
    <AdminPanel
      matches={matches as MatchWithPlayers[]}
      americanoEvents={americanoEvents}
      roundRobinEvents={roundRobinEvents}
      players={players}
    />
  )
}
