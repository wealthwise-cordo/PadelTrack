import Link from 'next/link'
import { Plus, Clock, CalendarDays } from 'lucide-react'
import MatchCard from '@/components/matches/MatchCard'
import PushToggle from '@/components/shared/PushToggle'
import { getMatchesForPlayer, getPendingForUser, AUTO_CONFIRM_HOURS } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export const revalidate = 0

// The filter buttons. "All" shows every section in order: pending (scores
// to add, then scores to confirm), upcoming, then finished matches.
const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
] as const
type View = (typeof VIEWS)[number]['key']

export default async function MatchCentrePage({ searchParams }: { searchParams: { view?: string } }) {
  const view: View = VIEWS.some(v => v.key === searchParams.view) ? (searchParams.view as View) : 'all'
  const session = await requireSession()
  const [matches, toConfirm] = await Promise.all([
    getMatchesForPlayer(session.player.id, { withInvites: true }),
    getPendingForUser(session.userId),
  ])
  const toConfirmIds = new Set(toConfirm.map(m => m.id))
  const byId = new Map(matches.map(m => [m.id, m]))
  const needsMe = toConfirm.map(m => byId.get(m.id) ?? m)
  const waitingOnOthers = matches.filter(m => m.status === 'pending' && !toConfirmIds.has(m.id))
  const completed = matches.filter(m => m.status === 'complete')
  // Set up in advance: still to play (soonest first), or started and
  // waiting for a score.
  const nowMs = Date.now()
  const scheduled = matches.filter(m => m.status === 'scheduled')
  const upcoming = scheduled.filter(m => new Date(m.playedAt).getTime() > nowMs).sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  const toScore = scheduled.filter(m => new Date(m.playedAt).getTime() <= nowMs)
  const viewer = { playerId: session.player.id, userId: session.userId }
  const pendingHasGuests = [...needsMe, ...waitingOnOthers].some(m => m.guests.length > 0)
  const [latest, ...history] = completed
  const rankedCount = completed.filter(m => m.isRanked).length
  const pendingCount = toScore.length + needsMe.length + waitingOnOthers.length
  const counts: Record<View, number> = { all: 0, pending: pendingCount, upcoming: upcoming.length, finished: completed.length }
  const show = (section: Exclude<View, 'all'>) => view === 'all' || view === section
  const empty = view === 'all' ? !matches.length : counts[view] === 0

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Match Centre</h1>
          <p className="text-sm text-zinc-500">{rankedCount} ranked {rankedCount === 1 ? 'match' : 'matches'}</p>
        </div>
        <Link href="/matches/new" className="flex items-center gap-1.5 text-sm font-bold text-white bg-orange-500 rounded-lg px-3 py-1.5 hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      <PushToggle variant="card" />

      <nav className="flex gap-1 p-1 rounded-xl bg-zinc-100" aria-label="Filter matches">
        {VIEWS.map(v => (
          <Link
            key={v.key}
            href={v.key === 'all' ? '/matches' : `/matches?view=${v.key}`}
            scroll={false}
            aria-current={view === v.key ? 'page' : undefined}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition',
              view === v.key ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
            )}
          >
            {v.label}
            {v.key !== 'all' && counts[v.key] > 0 && (
              <span className={cn('text-[10px] font-semibold', view === v.key ? 'text-zinc-400' : v.key === 'pending' ? 'text-orange-600' : 'text-zinc-400')}>{counts[v.key]}</span>
            )}
          </Link>
        ))}
      </nav>

      {show('pending') && pendingCount > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending
          </h2>
          {/* Scores to add first, then scores waiting to be confirmed. */}
          {toScore.map(m => <MatchCard key={m.id} match={m} viewer={viewer} />)}
          {needsMe.map(m => <MatchCard key={m.id} match={m} canConfirm canDelete viewer={viewer} />)}
          {waitingOnOthers.map(m => <MatchCard key={m.id} match={m} canDelete viewer={viewer} />)}
          {(needsMe.length > 0 || waitingOnOthers.length > 0) && <p className="text-[11px] text-zinc-400">
            {pendingHasGuests
              ? <>A ranked match needs one opponent to confirm the score, and any guests to join PadelTrack. After {AUTO_CONFIRM_HOURS} hours it confirms automatically — or becomes a friendly if a guest still hasn’t joined.</>
              : <>One opponent needs to confirm the score. If nobody responds within {AUTO_CONFIRM_HOURS} hours, it confirms automatically.</>}
          </p>}
        </section>
      )}

      {show('upcoming') && upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Upcoming
          </h2>
          {upcoming.map(m => <MatchCard key={m.id} match={m} viewer={viewer} />)}
        </section>
      )}

      {show('finished') && latest && (
        <section className="space-y-3">
          <MatchCard match={latest} canDelete featured />
          {history.map(m => <MatchCard key={m.id} match={m} canDelete />)}
        </section>
      )}

      {empty && (
        <div className="text-center py-10 text-zinc-500 text-sm">
          {{ all: 'No matches yet.', pending: 'Nothing pending — no scores to add or confirm.', upcoming: 'No upcoming matches. Pick a future date in New match to set one up.', finished: 'No finished matches yet.' }[view]}
        </div>
      )}
    </div>
  )
}
