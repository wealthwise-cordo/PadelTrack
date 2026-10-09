import SnakeLaddersSetup from '@/components/events/SnakeLaddersSetup'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'

export const revalidate = 0

export default async function SnakeLaddersPage() {
  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const [players, pastEvents] = await Promise.all([getPlayers(season.id), listSnakeLaddersEvents(season.id)])

  return <SnakeLaddersSetup players={players} pastEvents={pastEvents} />
}
