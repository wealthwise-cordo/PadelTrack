import OnePointSetup from '@/components/events/OnePointSetup'
import { getPlayers } from '@/lib/store'
import { listOnePointEvents } from '@/lib/one-point-store'

export const revalidate = 0

export default async function OnePointPage() {
  const [players, pastEvents] = await Promise.all([getPlayers(), listOnePointEvents()])

  return <OnePointSetup players={players} pastEvents={pastEvents} />
}
