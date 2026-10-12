import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Swords, Handshake } from 'lucide-react'
import MatchCard from '@/components/matches/MatchCard'
import { getPlayer, getMatchesForPlayer } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export const revalidate = 0

// Every confirmed match you've played against, or alongside, one player.
export default async function VersusPage({ params, searchParams }: { params: { id: string }; searchParams: { view?: string } }) {
  const session = await requireSession()
  const meId = session.player.id
  if (params.id === meId) redirect(`/players/${meId}`)

  const [them, myMatches] = await Promise.all([getPlayer(params.id), getMatchesForPlayer(meId)])
  if (!them || them.isDeleted) notFound()

  const view = searchParams.view === 'partners' ? 'partners' : 'against'
  const shared = myMatches.filter(m => m.status === 'complete' && m.isRanked)
  const sideOf = (m: (typeof shared)[number], id: string) =>
    [m.teamAPlayer1Id, m.teamAPlayer2Id].includes(id) ? 'A' : [m.teamBPlayer1Id, m.teamBPlayer2Id].includes(id) ? 'B' : null
  const against = shared.filter(m => { const t = sideOf(m, them.id); return t && t !== sideOf(m, meId) })
  const partners = shared.filter(m => { const t = sideOf(m, them.id); return t && t === sideOf(m, meId) })
  const record = (list: typeof shared) => {
    const wins = list.filter(m => m.winner === sideOf(m, meId)).length
    return { wins, losses: list.length - wins }
  }
  const list = view === 'partners' ? partners : against
  const first = them.name.split(' ')[0]

  const tabs = [
    { key: 'against', label: `Against ${first}`, icon: Swords, count: against.length, rec: record(against) },
    { key: 'partners', label: 'As partners', icon: Handshake, count: partners.length, rec: record(partners) },
  ]

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/players/${them.id}`} className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors shrink-0" aria-label="Back to profile">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-black tracking-tight truncate">You &amp; {first}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tabs.map(({ key, label, icon: Icon, rec }) => (
          <Link
            key={key}
            href={`/players/${them.id}/vs?view=${key}`}
            className={cn(
              'rounded-xl p-4 transition-colors border-2',
              view === key ? 'bg-zinc-900 text-white border-orange-500' : 'bg-zinc-900/90 text-white border-transparent hover:bg-zinc-800'
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
              <Icon className="h-3.5 w-3.5 text-orange-500" /> {label}
            </div>
            <div className="font-mono font-black text-2xl">
              <span className="text-orange-500">{rec.wins}W</span>
              <span className="text-zinc-500 mx-1.5">–</span>
              {rec.losses}L
            </div>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        {list.length === 0 ? (
          <div className="text-center py-12 text-sm text-zinc-500">
            {view === 'partners' ? `You haven’t partnered ${first} in a ranked match yet.` : `You haven’t played against ${first} in a ranked match yet.`}
          </div>
        ) : (
          list.map(m => <MatchCard key={m.id} match={m} canDelete />)
        )}
      </section>
    </div>
  )
}
