import AmericanoSetup from '@/components/events/AmericanoSetup'
import { getPlayers } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'

export const revalidate = 0

export default async function AmericanoPage() {
  const [players, pastEvents] = await Promise.all([getPlayers(), listAmericanoEvents()])

  return <AmericanoSetup players={players} pastEvents={pastEvents} />
}
