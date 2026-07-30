import { getMatches, getPlayers } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'
import AdminPanel from '@/components/admin/AdminPanel'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const [matches, americanoEvents, players] = await Promise.all([
    getMatches(),
    listAmericanoEvents(),
    getPlayers(),
  ])
  return <AdminPanel matches={matches as MatchWithPlayers[]} americanoEvents={americanoEvents} players={players} />
}
