import { notFound } from 'next/navigation'
import { getSnakeLaddersEvent } from '@/lib/snake-ladders-store'
import { getEventPlayers, getUserName } from '@/lib/store'
import { requireSession } from '@/lib/session'
import SnakeLaddersEventView from '@/components/events/SnakeLaddersEventView'
import EventLiveBar from '@/components/events/EventLiveBar'

export const revalidate = 0

export default async function SnakeLaddersEventPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const event = await getSnakeLaddersEvent(params.id)
  if (!event) notFound()

  const playerIds = event.playerIds
  const [players, organiserName] = await Promise.all([getEventPlayers(playerIds), getUserName(event.ownerId)])
  const role = event.ownerId === session.userId ? 'organiser' : playerIds.includes(session.player.id) ? 'player' : 'viewer'

  return (
    <>
      <EventLiveBar live={event.status === 'in_progress'} organiserName={organiserName ?? 'someone'} role={role} />
      <SnakeLaddersEventView event={event} players={players} />
    </>
  )
}
