import RoundRobinSetup from '@/components/events/RoundRobinSetup'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { redirect } from 'next/navigation'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { getViewedSeason } from '@/lib/view-season'
import { listRoundRobinEvents } from '@/lib/round-robin-store'

export const revalidate = 0

export default async function RoundRobinPage() {
  const viewed = await getViewedSeason()
  if (viewed && viewed.status !== 'active') redirect(`/seasons/${viewed.id}`)

  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const [players, pastEvents] = await Promise.all([getPlayers(season.id), listRoundRobinEvents(season.id)])

  return <RoundRobinSetup players={players} pastEvents={pastEvents} />
}
