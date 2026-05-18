import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getPlayers } from '@/lib/store'

export const revalidate = 0

export default async function NewMatchPage() {
  const players = getPlayers()

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Record Match</h1>
      <MatchEntryForm players={players as any} />
    </div>
  )
}
