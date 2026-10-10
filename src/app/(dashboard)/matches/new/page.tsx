import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getPickablePlayers, getPlayer } from '@/lib/store'
import { requireSession } from '@/lib/session'

export const revalidate = 0

export default async function NewMatchPage() {
  const session = await requireSession()
  const [me, players] = await Promise.all([getPlayer(session.player.id), getPickablePlayers(session.userId)])
  return <MatchEntryForm me={me!} players={players} />
}
