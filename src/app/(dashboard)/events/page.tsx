import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Shuffle, RotateCcw, Zap, ArrowUpDown, ChevronRight, Info } from 'lucide-react'
import { requireSession } from '@/lib/session'
import { listAmericanoEvents } from '@/lib/americano-store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'
import { listOnePointEvents } from '@/lib/one-point-store'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'

export const revalidate = 0

const formats = [
  {
    icon: Shuffle,
    name: 'Americano',
    description: 'Rotating partners each round. Points add up individually — everyone plays with and against everyone.',
    tag: '4–8 players',
    href: '/events/americano',
  },
  {
    icon: RotateCcw,
    name: 'Round Robin',
    description: 'Fixed pairs, every team plays every other team once. First to 4, 6 or 8 games.',
    tag: '3–4 teams',
    href: '/events/round-robin',
  },
  {
    icon: ArrowUpDown,
    name: 'Snake and Ladders',
    description: 'Two courts. Win and climb to the top court, lose and slide down — the final round decides 1st to 4th.',
    tag: '8 players',
    href: '/events/snake-ladders',
  },
  {
    icon: Zap,
    name: 'One Point',
    description: 'Seeded knockout where every match is sudden death — one point decides it.',
    tag: '8 players',
    href: '/events/one-point',
  },
]

export default async function EventsPage() {
  const session = await requireSession()
  const actor = { userId: session.userId, playerId: session.player.id }
  const [am, rr, op, sl] = await Promise.all([
    listAmericanoEvents(actor),
    listRoundRobinEvents(actor),
    listOnePointEvents(actor),
    listSnakeLaddersEvents(actor),
  ])
  const recent = [
    ...am.map(e => ({ ...e, format: 'Americano', href: `/events/americano/${e.id}` })),
    ...rr.map(e => ({ ...e, format: 'Round Robin', href: `/events/round-robin/${e.id}` })),
    ...op.map(e => ({ ...e, format: 'One Point', href: `/events/one-point/${e.id}` })),
    ...sl.map(e => ({ ...e, format: 'Snake and Ladders', href: `/events/snake-ladders/${e.id}` })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Events</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Run a social event with anyone — users or guests.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-zinc-100 px-3.5 py-3 text-xs text-zinc-600">
        <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-px" />
        <span>Events are separate from rankings — results here never change anyone&apos;s rating. Use <Link href="/matches/new" className="font-semibold text-orange-600 hover:underline">New Match</Link> for ranked games.</span>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Start an event</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {formats.map(({ icon: Icon, name, description, tag, href }) => (
            <Link key={name} href={href} className="ptr-card flex items-start gap-3 group">
              <span className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-orange-500" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm group-hover:text-orange-600 transition-colors">{name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">{tag}</span>
                </span>
                <span className="block text-xs text-zinc-500 leading-relaxed">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your events</h2>
          <div className="glass rounded-xl divide-y divide-zinc-100">
            {recent.map(e => (
              <Link key={e.id} href={e.href} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors first:rounded-t-xl last:rounded-b-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{e.format}</div>
                  <div className="text-xs text-zinc-500">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })} · {e.matchesComplete}/{e.matchesTotal} matches
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${e.status === 'complete' ? 'bg-zinc-900 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  {e.status === 'complete' ? 'Done' : 'Live'}
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
