import Link from 'next/link'
import AuthShell from '@/components/shared/AuthShell'
import SignUpForm from '@/components/shared/SignUpForm'
import ClaimButton from '@/components/players/ClaimButton'
import { getGuestByClaimToken } from '@/lib/store'
import { getSession } from '@/lib/session'
import { formatPTR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ClaimPage({ params }: { params: { token: string } }) {
  const [guest, session] = await Promise.all([getGuestByClaimToken(params.token), getSession()])

  if (!guest) {
    return (
      <AuthShell subtitle="This invite link is no longer valid">
        <p className="text-sm text-center text-zinc-600">
          It may already have been used. Ask whoever sent it for a new one, or{' '}
          <Link href="/signup" className="font-semibold text-orange-600 hover:underline">create a fresh account</Link>.
        </p>
      </AuthShell>
    )
  }

  const summary = (
    <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-3">
      <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: guest.avatarColor }}>
        {guest.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate">{guest.name}</div>
        <div className="text-xs text-muted-foreground">
          Added by {guest.createdBy?.name ?? 'a friend'} · {guest.matchesPlayed} matches
        </div>
      </div>
      <div className="font-mono font-black text-lg text-orange-600">{formatPTR(guest.ptr)}</div>
    </div>
  )

  if (session) {
    return (
      <AuthShell subtitle="Claim this profile to keep its rating and matches">
        {summary}
        <ClaimButton token={params.token} />
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="You've been added to PadelTrack — create an account to claim your profile">
      {summary}
      <SignUpForm claimToken={params.token} defaultName={guest.name} />
      <p className="text-sm text-muted-foreground text-center mt-6">
        Already have an account?{' '}
        <Link href={`/login?next=/claim/${params.token}`} className="font-semibold text-orange-600 hover:underline">Sign in to claim</Link>
      </p>
    </AuthShell>
  )
}
