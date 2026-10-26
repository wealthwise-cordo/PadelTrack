import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/session'
import { getRole } from '@/lib/roles'
import { getAdminMatchLog, getAdminMatchQueue } from '@/lib/admin-matches'
import MatchCard from '@/components/matches/MatchCard'
import AdminMatchActions from '@/components/admin/AdminMatchActions'
import { getAllMatches } from '@/lib/store'
import { cn } from '@/lib/utils'

export const revalidate = 0

const ACTION_LABEL = { confirm: 'Confirmed', settle: 'Settled', void: 'Voided' } as Record<string, string>
const PAGE_SIZE = 25
const FILTERS = [
  { key: 'all', label: 'All', ranked: undefined },
  { key: 'ranked', label: 'Ranked', ranked: true },
  { key: 'friendlies', label: 'Friendlies', ranked: false },
] as const
type Filter = (typeof FILTERS)[number]['key']

const ACTION_STYLE = { confirm: 'bg-emerald-100 text-emerald-800', settle: 'bg-orange-100 text-orange-800', void: 'bg-zinc-200 text-zinc-700' } as Record<string, string>

// Admin → Matches (super user): matches that aren't confirmed and may need a
// hand — disputes, unconfirmed scores, and matches set up in advance that
// were never scored — with the log of what's been done, and every match
// saved, filterable by ranked and friendlies.
export default async function AdminMatchesPage({ searchParams }: { searchParams: { type?: string; page?: string } }) {
  const session = await requireSession()
  if ((await getRole(session.userId)) !== 'superuser') notFound()
  const filter = FILTERS.find(f => f.key === searchParams.type) ?? FILTERS[0]
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1)
  const [queue, log, all] = await Promise.all([
    getAdminMatchQueue(session.player.id),
    getAdminMatchLog(),
    getAllMatches({ ranked: filter.ranked, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])
  const pages = Math.max(1, Math.ceil(all.total / PAGE_SIZE))
  const href = (type: Filter, p = 1) => {
    const q = new URLSearchParams()
    if (type !== 'all') q.set('type', type)
    if (p > 1) q.set('page', String(p))
    const qs = q.toString()
    return `/admin/matches${qs ? `?${qs}` : ''}#all-matches`
  }
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

      <section id="all-matches" className="space-y-4 scroll-mt-20">
        <h3 className="text-sm font-semibold">All matches <span className="text-zinc-400 font-medium">({all.counts.all})</span></h3>
        <nav className="flex gap-1 p-1 rounded-xl bg-zinc-100" aria-label="Filter all matches">
          {FILTERS.map(f => (
            <Link
              key={f.key}
              href={href(f.key)}
              scroll={false}
              aria-current={filter.key === f.key ? 'page' : undefined}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition',
                filter.key === f.key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              {f.label}
              <span className="text-[10px] font-semibold text-zinc-400">{all.counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        {all.matches.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches.</p>
        ) : all.matches.map(m => <MatchCard key={m.id} match={m} readOnly />)}
        {pages > 1 && (
          <div className="flex items-center justify-between text-xs">
            {page > 1 ? <Link href={href(filter.key, page - 1)} scroll={false} className="font-semibold text-zinc-600 hover:text-zinc-900">← Newer</Link> : <span />}
            <span className="text-zinc-400">Page {page} of {pages}</span>
            {page < pages ? <Link href={href(filter.key, page + 1)} scroll={false} className="font-semibold text-zinc-600 hover:text-zinc-900">Older →</Link> : <span />}
          </div>
        )}
      </section>
    </div>
  )
}
