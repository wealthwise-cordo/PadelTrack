import { notFound, redirect } from 'next/navigation'
import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getClubs, getMatchById, getPickablePlayers, getPlayer, getRecentLocations } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { formExisting } from '@/lib/scheduled-form'

export const revalidate = 0

// Changing (or deleting) a match before its score is confirmed: the organiser
// of a scheduled match, or whoever entered the score of a pending one.
export default async function EditMatchPage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const meId = session.player.id
  const [m, me, pickable, locations, clubs] = await Promise.all([
    getMatchById(params.id), getPlayer(meId), getPickablePlayers(session.userId), getRecentLocations(meId), getClubs(),
  ])
  if (!m || !me) notFound()
  const canEditScheduled = m.status === 'scheduled' && m.organiserId === session.userId
  // Not once someone else has entered a score too (that's theirs to stand by).
  const canEditPending = m.status === 'pending' && !m.scoreConfirmed && !m.disputed && m.recordedById === session.userId &&
    m.scoreReports.filter(r => r.status === 'open').length <= 1
  if (!canEditScheduled && !canEditPending) redirect('/matches')
  // A match set up in advance can only be deleted (cancelled) by its organiser.
  const canDelete = !m.organiserId || m.organiserId === session.userId

  // Everyone already in it stays pickable, even if they're not in your circle.
  const lineup = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]
  const players = [...pickable, ...lineup.filter(p => !pickable.some(x => x.id === p.id))]

  return (
    <MatchEntryForm
      me={me} players={players} lineups={[]} recentLocations={locations} clubs={clubs}
      mode="edit" existing={{ ...formExisting(m, meId), canDelete }}
    />
  )
}
