import SnakeLaddersSetup from '@/components/events/SnakeLaddersSetup'
import { getPickablePlayers, getEventPlayers } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'

export const revalidate = 0

export default async function SnakeLaddersPage() {
  const session = await requireSession()
  const actor = { userId: session.userId, playerId: session.player.id }
  const [players, pastEvents] = await Promise.all([getPickablePlayers(session.userId), listSnakeLaddersEvents(actor)])
  const knownPlayers = await getEventPlayers(Array.from(new Set(pastEvents.flatMap(e => e.playerIds))))
  return <SnakeLaddersSetup players={players} knownPlayers={knownPlayers} pastEvents={pastEvents} meId={session.player.id} />
}
