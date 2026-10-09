import { notFound } from 'next/navigation'
import { getAmericanoEvent } from '@/lib/americano-store'
import { getPlayers } from '@/lib/store'
import AmericanoEventView from '@/components/events/AmericanoEventView'

export const revalidate = 0

export default async function AmericanoEventPage({ params }: { params: { id: string } }) {
  const event = await getAmericanoEvent(params.id)
  if (!event) notFound()

  const allPlayers = await getPlayers(event.seasonId)
  const players = allPlayers.filter(p => event.playerIds.includes(p.id))

  return <AmericanoEventView event={event} players={players} />
}
