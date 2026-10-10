import { notFound } from 'next/navigation'
import { getOnePointEvent } from '@/lib/one-point-store'
import { getEventPlayers, getUserName } from '@/lib/store'
import { requireSession } from '@/lib/session'
import OnePointEventView from '@/components/events/OnePointEventView'
import EventLiveBar from '@/components/events/EventLiveBar'

export const revalidate = 0

export default async function OnePointEventPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const event = await getOnePointEvent(params.id)
  if (!event) notFound()

  const playerIds = event.playerIds
  const [players, organiserName] = await Promise.all([getEventPlayers(playerIds), getUserName(event.ownerId)])
  const role = event.ownerId === session.userId ? 'organiser' : playerIds.includes(session.player.id) ? 'player' : 'viewer'

  return (
    <>
      <EventLiveBar live={event.status === 'in_progress'} organiserName={organiserName ?? 'someone'} role={role} />
      <OnePointEventView event={event} players={players} />
    </>
  )
}
