import { notFound, redirect } from 'next/navigation'
import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getClubs, getMatchById, getPickablePlayers, getPlayer, getRecentLocations } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { formExisting } from '@/lib/scheduled-form'

export const revalidate = 0

// The organiser changing (or cancelling) a match they set up in advance,
// until a score is entered.
export default async function EditMatchPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const meId = session.player.id
  const [m, me, pickable, locations, clubs] = await Promise.all([
    getMatchById(params.id), getPlayer(meId), getPickablePlayers(session.userId), getRecentLocations(meId), getClubs(),
  ])
  if (!m || !me) notFound()
  if (m.organiserId !== session.userId || m.status !== 'scheduled') redirect('/matches')

  // Everyone already in it stays pickable, even if they're not in your circle.
  const lineup = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]
  const players = [...pickable, ...lineup.filter(p => !pickable.some(x => x.id === p.id))]

  return (
    <MatchEntryForm
      me={me} players={players} lineups={[]} recentLocations={locations} clubs={clubs}
      mode="edit" existing={formExisting(m, meId)}
    />
  )
}
