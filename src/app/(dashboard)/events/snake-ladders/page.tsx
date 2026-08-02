import SnakeLaddersSetup from '@/components/events/SnakeLaddersSetup'
import { getPlayers } from '@/lib/store'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'

export const revalidate = 0

export default async function SnakeLaddersPage() {
  const [players, pastEvents] = await Promise.all([getPlayers(), listSnakeLaddersEvents()])

  return <SnakeLaddersSetup players={players} pastEvents={pastEvents} />
}
