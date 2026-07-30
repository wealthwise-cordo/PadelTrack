import { notFound } from 'next/navigation'
import { getRoundRobinEvent } from '@/lib/round-robin-store'
import { getPlayers } from '@/lib/store'
import RoundRobinEventView from '@/components/events/RoundRobinEventView'

export const revalidate = 0

export default async function RoundRobinEventPage({ params }: { params: { id: string } }) {
  const event = await getRoundRobinEvent(params.id)
  if (!event) notFound()

  const allPlayers = await getPlayers()
  const playerIds = event.teams.flat()
  const players = allPlayers.filter(p => playerIds.includes(p.id))

  return <RoundRobinEventView event={event} players={players} />
}
