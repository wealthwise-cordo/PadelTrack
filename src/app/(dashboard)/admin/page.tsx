import { getMatches } from '@/lib/store'
import AdminPanel from '@/components/admin/AdminPanel'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function AdminPage() {
  const matches = await getMatches()
  return <AdminPanel matches={matches as MatchWithPlayers[]} />
}
