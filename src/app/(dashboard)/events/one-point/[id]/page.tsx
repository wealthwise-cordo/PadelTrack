import { notFound } from 'next/navigation'
import { getOnePointEvent } from '@/lib/one-point-store'
import { getPlayers } from '@/lib/store'
import OnePointEventView from '@/components/events/OnePointEventView'

export const revalidate = 0

export default async function OnePointEventPage({ params }: { params: { id: string } }) {
  const event = await getOnePointEvent(params.id)
  if (!event) notFound()

  const allPlayers = await getPlayers(event.seasonId)
  const players = allPlayers.filter(p => event.playerIds.includes(p.id))

  return <OnePointEventView event={event} players={players} />
}
