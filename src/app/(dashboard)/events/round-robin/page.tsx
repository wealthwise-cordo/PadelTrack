import RoundRobinSetup from '@/components/events/RoundRobinSetup'
import { getPlayers } from '@/lib/store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'

export const revalidate = 0

export default async function RoundRobinPage() {
  const [players, pastEvents] = await Promise.all([getPlayers(), listRoundRobinEvents()])

  return <RoundRobinSetup players={players} pastEvents={pastEvents} />
}
