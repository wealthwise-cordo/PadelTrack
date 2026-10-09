import { notFound } from 'next/navigation'
import { getSnakeLaddersEvent } from '@/lib/snake-ladders-store'
import { getPlayers } from '@/lib/store'
import SnakeLaddersEventView from '@/components/events/SnakeLaddersEventView'

export const revalidate = 0

export default async function SnakeLaddersEventPage({ params }: { params: { id: string } }) {
  const event = await getSnakeLaddersEvent(params.id)
  if (!event) notFound()

  const allPlayers = await getPlayers(event.seasonId)
  const players = allPlayers.filter(p => event.playerIds.includes(p.id))

  return <SnakeLaddersEventView event={event} players={players} />
}
