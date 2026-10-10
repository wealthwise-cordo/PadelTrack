import RoundRobinSetup from '@/components/events/RoundRobinSetup'
import { getPickablePlayers, getEventPlayers } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { listRoundRobinEvents } from '@/lib/round-robin-store'

export const revalidate = 0

export default async function RoundRobinPage() {
  const session = await requireSession()
  const actor = { userId: session.userId, playerId: session.player.id }
  const [players, pastEvents] = await Promise.all([getPickablePlayers(session.userId), listRoundRobinEvents(actor)])
  const knownPlayers = await getEventPlayers(Array.from(new Set(pastEvents.flatMap(e => e.teams.flat()))))
  return <RoundRobinSetup players={players} knownPlayers={knownPlayers} pastEvents={pastEvents} meId={session.player.id} />
}
