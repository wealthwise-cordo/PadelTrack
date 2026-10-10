import Link from 'next/link'
import { Plus, Clock } from 'lucide-react'
import MatchCard from '@/components/matches/MatchCard'
import { getMatchesForPlayer, getPendingForUser, AUTO_CONFIRM_HOURS } from '@/lib/store'
import { requireSession } from '@/lib/session'

export const revalidate = 0

export default async function MatchCentrePage() {
  const session = await requireSession()
  const [matches, toConfirm] = await Promise.all([
    getMatchesForPlayer(session.player.id),
    getPendingForUser(session.userId),
  ])
  const toConfirmIds = new Set(toConfirm.map(m => m.id))
  const byId = new Map(matches.map(m => [m.id, m]))
  const needsMe = toConfirm.map(m => byId.get(m.id) ?? m)
  const waitingOnOthers = matches.filter(m => m.status === 'pending' && !toConfirmIds.has(m.id))
  const completed = matches.filter(m => m.status === 'complete')
  const [latest, ...history] = completed

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Match Centre</h1>
          <p className="text-sm text-zinc-500">{completed.length} confirmed {completed.length === 1 ? 'match' : 'matches'}</p>
        </div>
        <Link href="/matches/new" className="flex items-center gap-1.5 text-sm font-bold text-white bg-orange-500 rounded-lg px-3 py-1.5 hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {(needsMe.length > 0 || waitingOnOthers.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending
          </h2>
          {needsMe.map(m => <MatchCard key={m.id} match={m} canConfirm canDelete />)}
          {waitingOnOthers.map(m => <MatchCard key={m.id} match={m} canDelete />)}
          <p className="text-[11px] text-zinc-400">
            One opponent needs to confirm. If nobody responds within {AUTO_CONFIRM_HOURS} hours, the match confirms automatically.
          </p>
        </section>
      )}

      {latest ? (
        <section className="space-y-3">
          <MatchCard match={latest} canDelete featured />
          {history.map(m => <MatchCard key={m.id} match={m} canDelete />)}
        </section>
      ) : (
        <div className="text-center py-10 text-zinc-500 text-sm">No confirmed matches yet.</div>
      )}
    </div>
  )
}
