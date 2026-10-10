import { notFound } from 'next/navigation'
import { getAmericanoEvent } from '@/lib/americano-store'
import { getEventPlayers, getUserName } from '@/lib/store'
import { requireSession } from '@/lib/session'
import AmericanoEventView from '@/components/events/AmericanoEventView'
import EventLiveBar from '@/components/events/EventLiveBar'

export const revalidate = 0

export default async function AmericanoEventPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const event = await getAmericanoEvent(params.id)
  if (!event) notFound()

  const playerIds = event.playerIds
  const [players, organiserName] = await Promise.all([getEventPlayers(playerIds), getUserName(event.ownerId)])
  const role = event.ownerId === session.userId ? 'organiser' : playerIds.includes(session.player.id) ? 'player' : 'viewer'

  return (
    <>
      <EventLiveBar live={event.status === 'in_progress'} organiserName={organiserName ?? 'someone'} role={role} />
      <AmericanoEventView event={event} players={players} />
    </>
  )
}
