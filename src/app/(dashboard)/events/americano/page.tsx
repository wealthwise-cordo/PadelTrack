import AmericanoSetup from '@/components/events/AmericanoSetup'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { redirect } from 'next/navigation'
import { getPlayers, getActiveSeason } from '@/lib/store'
import { getViewedSeason } from '@/lib/view-season'
import { listAmericanoEvents } from '@/lib/americano-store'

export const revalidate = 0

export default async function AmericanoPage() {
  const viewed = await getViewedSeason()
  if (viewed && viewed.status !== 'active') redirect(`/seasons/${viewed.id}`)

  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const [players, pastEvents] = await Promise.all([getPlayers(season.id), listAmericanoEvents(season.id)])

  return <AmericanoSetup players={players} pastEvents={pastEvents} />
}
