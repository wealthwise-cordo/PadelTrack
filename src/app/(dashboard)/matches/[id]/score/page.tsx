import Link from 'next/link'
import { notFound } from 'next/navigation'
import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { getMatchById, getPlayer } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { formExisting } from '@/lib/scheduled-form'

export const revalidate = 0

// Entering the score of a match that was set up in advance, once it has
// started. Also how a player enters a different score when they think the
// one already in is wrong.
export default async function AddScorePage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const meId = session.player.id
  const [m, me] = await Promise.all([getMatchById(params.id), getPlayer(meId)])
  if (!m || !m.organiserId || !me) notFound()
  const lineup = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2]
  if (!lineup.some(p => p.id === meId)) notFound()
  // Not (or no longer) open for a score — e.g. it was just confirmed, which
  // also happens right after you save the matching score here.
  const open = m.status === 'scheduled' || (m.status === 'pending' && !m.scoreConfirmed)
  const started = new Date(m.playedAt).getTime() <= Date.now()
  if (!open || !started) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm text-zinc-500">{!started ? 'You can add the score once the match has started.' : 'This match’s score is confirmed.'}</p>
        <Link href="/matches" className="inline-block px-5 py-3 rounded-xl text-sm font-semibold bg-zinc-900 text-white">Match Centre</Link>
      </div>
    )
  }

  return (
    <MatchEntryForm
      me={me} players={lineup} lineups={[]} recentLocations={[]} clubs={[]}
      mode="score" existing={formExisting(m, meId)}
    />
  )
}
