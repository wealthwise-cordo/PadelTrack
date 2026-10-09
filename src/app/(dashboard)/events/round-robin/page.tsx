import RoundRobinSetup from '@/components/events/RoundRobinSetup'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'

export const revalidate = 0

export default async function RoundRobinPage() {
  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const [players, pastEvents] = await Promise.all([getPlayers(season.id), listRoundRobinEvents(season.id)])

  return <RoundRobinSetup players={players} pastEvents={pastEvents} />
}
