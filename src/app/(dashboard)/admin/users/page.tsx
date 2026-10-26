import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole } from '@/lib/roles'
import { getDuplicateCandidates, getGuestsAwaitingJoin, getRankedGuests } from '@/lib/admin-users'
import VerifyGuest from '@/components/admin/VerifyGuest'
import DuplicatePair from '@/components/admin/DuplicatePair'
import { formatRating } from '@/lib/utils'

export const revalidate = 0

const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
const when = (d: Date) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

// Admin → Users (super user): guests holding up ranked matches, who can be
// verified as ranked guests, the guests already verified, and players whose
// names are at least 90% alike, to merge or dismiss.
export default async function AdminUsersPage() {
  const session = await requireSession()
  if ((await getRole(session.userId)) !== 'superuser') notFound()
  const [waiting, ranked, duplicates] = await Promise.all([getGuestsAwaitingJoin(), getRankedGuests(), getDuplicateCandidates()])

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        A ranked match with a guest in it becomes a friendly if they don’t join within 48 hours. Verify a guest and set their level to make them a ranked guest: their ranked matches count without them joining, but they stay out of circles and rankings and nobody can open their full profile. If they join later, they keep that rating.
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Waiting to join {waiting.length > 0 && <span className="text-orange-600">({waiting.length})</span>}</h3>
        {waiting.length === 0 ? (
          <p className="text-sm text-zinc-500">No ranked matches are waiting on a guest.</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map(g => (
              <li key={g.id} className="glass rounded-xl p-4 space-y-3">
                <div>
                  <Link href={`/players/${g.id}`} className="font-semibold hover:underline">{g.name}</Link>
                  <div className="text-[11px] text-zinc-500">
                    Added by {g.addedBy ?? 'unknown'}
                    {g.suggestedLevel !== null && <> · they suggested {g.suggestedLevel.toFixed(1)}</>}
                    {' · '}{g.matches} ranked {g.matches === 1 ? 'match' : 'matches'} waiting
                  </div>
                  <div className="text-[11px] text-orange-700">Becomes a friendly {when(g.deadline)}</div>
                </div>
                <VerifyGuest playerId={g.id} name={g.name} suggestedLevel={g.suggestedLevel} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Ranked guests</h3>
        {ranked.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="glass rounded-xl divide-y divide-zinc-100">
            {ranked.map(g => (
              <li key={g.id} className="p-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <Link href={`/players/${g.id}`} className="font-medium hover:underline truncate block">{g.name}</Link>
                  <div className="text-[11px] text-zinc-400">Verified {date(g.rankedGuestAt!)} · added by {g.createdBy?.name ?? 'unknown'} · {g.matchesPlayed} ranked {g.matchesPlayed === 1 ? 'match' : 'matches'}</div>
                </div>
                <span className="font-mono font-semibold shrink-0">{formatRating(g.ptr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Possible duplicates {duplicates.length > 0 && <span className="text-orange-600">({duplicates.length})</span>}</h3>
        <p className="text-[11px] text-zinc-500">
          Players whose names are at least 90% alike, where at least one is a guest. Keep one and the other guest is merged into it: their matches and events move across, and if only the merged guest has ranked results, the one you keep takes over that rating. The merged guest’s invite link stops working.
        </p>
        {duplicates.length === 0 ? (
          <p className="text-sm text-zinc-500">None found.</p>
        ) : duplicates.map(d => <DuplicatePair key={`${d.a.id}-${d.b.id}`} {...d} />)}
      </section>
    </div>
  )
}
