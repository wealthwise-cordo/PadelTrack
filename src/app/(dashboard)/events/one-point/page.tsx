import OnePointSetup from '@/components/events/OnePointSetup'
import { getPickablePlayers, getEventPlayers } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { listOnePointEvents } from '@/lib/one-point-store'

export const revalidate = 0

export default async function OnePointPage() {
  const session = await requireSession()
  const actor = { userId: session.userId, playerId: session.player.id }
  const [players, pastEvents] = await Promise.all([getPickablePlayers(session.userId), listOnePointEvents(actor)])
  const knownPlayers = await getEventPlayers(Array.from(new Set(pastEvents.flatMap(e => e.playerIds))))
  return <OnePointSetup players={players} knownPlayers={knownPlayers} pastEvents={pastEvents} meId={session.player.id} />
}
