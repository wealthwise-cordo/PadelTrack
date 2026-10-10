import AmericanoSetup from '@/components/events/AmericanoSetup'
import { getPickablePlayers, getEventPlayers } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { listAmericanoEvents } from '@/lib/americano-store'

export const revalidate = 0

export default async function AmericanoPage() {
  const session = await requireSession()
  const actor = { userId: session.userId, playerId: session.player.id }
  const [players, pastEvents] = await Promise.all([getPickablePlayers(session.userId), listAmericanoEvents(actor)])
  const knownPlayers = await getEventPlayers(Array.from(new Set(pastEvents.flatMap(e => e.playerIds))))
  return <AmericanoSetup players={players} knownPlayers={knownPlayers} pastEvents={pastEvents} meId={session.player.id} />
}
