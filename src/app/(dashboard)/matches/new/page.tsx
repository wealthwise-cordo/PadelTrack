import MatchEntryForm from '@/components/matches/MatchEntryForm'
import NoActiveSeason from '@/components/shared/NoActiveSeason'
import { getPlayers, getActiveSeason } from '@/lib/store'

export const revalidate = 0

export default async function NewMatchPage() {
  const season = await getActiveSeason()
  if (!season) return <NoActiveSeason />

  const players = await getPlayers(season.id)

  return <MatchEntryForm players={players as any} />
}
