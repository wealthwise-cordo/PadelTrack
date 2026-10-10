import { notFound } from 'next/navigation'
import { getRoundRobinEvent } from '@/lib/round-robin-store'
import { getEventPlayers, getUserName } from '@/lib/store'
import { requireSession } from '@/lib/session'
import RoundRobinEventView from '@/components/events/RoundRobinEventView'
import EventLiveBar from '@/components/events/EventLiveBar'

export const revalidate = 0

export default async function RoundRobinEventPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const event = await getRoundRobinEvent(params.id)
  if (!event) notFound()

  const playerIds = event.teams.flat()
  const [players, organiserName] = await Promise.all([getEventPlayers(playerIds), getUserName(event.ownerId)])
  const role = event.ownerId === session.userId ? 'organiser' : playerIds.includes(session.player.id) ? 'player' : 'viewer'

  return (
    <>
      <EventLiveBar live={event.status === 'in_progress'} organiserName={organiserName ?? 'someone'} role={role} />
      <RoundRobinEventView event={event} players={players} />
    </>
  )
}
