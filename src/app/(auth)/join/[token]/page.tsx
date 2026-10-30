import Link from 'next/link'
import AuthShell from '@/components/shared/AuthShell'
import SignUpForm from '@/components/shared/SignUpForm'
import JoinMatch from '@/components/matches/JoinMatch'
import { getMatchByJoinToken } from '@/lib/scheduled-matches'
import { getSession } from '@/lib/session'
import { whenLabel } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Join a padel match · PadelTrack' }

// A match's join link, shared by its organiser: pick an open spot (which
// also picks your partner). Signed-out visitors sign up or sign in first and
// come back here.
export default async function JoinPage({ params }: { params: { token: string } }) {
  const [m, session] = await Promise.all([getMatchByJoinToken(params.token), getSession()])

  if (!m) {
    return (
      <AuthShell subtitle="This match link is no longer valid">
        <p className="text-sm text-center text-zinc-600">The match may have been played or cancelled. Ask whoever sent it for a new link.</p>
      </AuthShell>
    )
  }

  const back = `/join/${params.token}`
  const seats = [m.teamAPlayer1, m.teamAPlayer2, m.teamBPlayer1, m.teamBPlayer2].map(p => p && { id: p.id, name: p.name, avatarColor: p.avatarColor })
  const where = m.location ? ` · ${m.location}` : ''
  const subtitle = `${whenLabel(new Date(m.playedAt))}${where} · ${m.isRanked ? 'Ranked' : 'Friendly'}`
  const isIn = !!session && seats.some(p => p?.id === session.player.id)

  if (session) {
    return (
      <AuthShell subtitle={subtitle}>
        <JoinMatch token={params.token} seats={seats} isIn={isIn} />
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle={subtitle}>
      <JoinMatch token={params.token} seats={seats} isIn={false} preview />
      <p className="text-sm text-zinc-600 text-center my-6">Create an account to take a spot</p>
      <SignUpForm next={back} />
      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{' '}
        <Link href={`/login?next=${back}`} className="font-semibold text-orange-600 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
