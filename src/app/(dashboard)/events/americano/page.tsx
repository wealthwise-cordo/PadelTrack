import AmericanoSetup from '@/components/events/AmericanoSetup'
import { getPlayers } from '@/lib/store'

export const revalidate = 0

export default async function AmericanoPage() {
  const players = await getPlayers()

  return <AmericanoSetup players={players} />
}
