import OnePointSetup from '@/components/events/OnePointSetup'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { redirect } from 'next/navigation'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { getViewedSeason } from '@/lib/view-season'
import { listOnePointEvents } from '@/lib/one-point-store'

export const revalidate = 0

export default async function OnePointPage() {
  const viewed = await getViewedSeason()
  if (viewed && viewed.status !== 'active') redirect(`/seasons/${viewed.id}`)

  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const [players, pastEvents] = await Promise.all([getPlayers(season.id), listOnePointEvents(season.id)])

  return <OnePointSetup players={players} pastEvents={pastEvents} />
}
