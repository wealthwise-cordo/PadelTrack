import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getPlayers } from '@/lib/store'

export const revalidate = 0

export default async function NewMatchPage() {
  const players = await getPlayers()

  return <MatchEntryForm players={players as any} />
}
