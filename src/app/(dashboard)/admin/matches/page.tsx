import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole } from '@/lib/roles'
import { getAdminMatchLog, getAdminMatchQueue } from '@/lib/admin-matches'
import MatchCard from '@/components/matches/MatchCard'
import AdminMatchActions from '@/components/admin/AdminMatchActions'

export const revalidate = 0

const ACTION_LABEL = { confirm: 'Confirmed', settle: 'Settled', void: 'Voided' } as Record<string, string>
const ACTION_STYLE = { confirm: 'bg-emerald-100 text-emerald-800', settle: 'bg-orange-100 text-orange-800', void: 'bg-zinc-200 text-zinc-700' } as Record<string, string>

// Admin → Matches (super user): matches that aren't confirmed and may need a
// hand — disputes, unconfirmed scores, and matches set up in advance that
// were never scored — with the log of what's been done.
export default async function AdminMatchesPage() {
  const session = await requireSession()
  if ((await getRole(session.userId)) !== 'superuser') notFound()
  const [queue, log] = await Promise.all([getAdminMatchQueue(session.player.id), getAdminMatchLog()])
  const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">
          Other players’ matches that aren’t confirmed yet (your own you handle as a player). You can confirm a stuck score, settle a dispute by picking the right score, or void a match — always with a reason, which the players are sent. Confirmed matches can’t be changed here.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Needs attention {queue.length > 0 && <span className="text-orange-600">({queue.length})</span>}</h3>
        {queue.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing waiting.</p>
        ) : queue.map(m => (
          <div key={m.id} className="space-y-2">
            <MatchCard match={m} readOnly />
            <AdminMatchActions matchId={m.id} status={m.status} disputed={m.disputed} reports={m.scoreReports} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">History</h3>
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="glass rounded-xl divide-y divide-zinc-100">
            {log.map(a => (
              <li key={a.id} className="p-3 text-sm space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${ACTION_STYLE[a.action] ?? ''}`}>{ACTION_LABEL[a.action] ?? a.action}</span>
                  <span className="truncate text-zinc-800">{a.summary}</span>
                </div>
                <div className="text-zinc-700">{a.reason}</div>
                <div className="text-[11px] text-zinc-400">{date(a.createdAt)} · by {a.by?.name ?? 'unknown'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
