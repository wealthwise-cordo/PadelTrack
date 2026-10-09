import Link from 'next/link'
import { LayoutGrid, Shuffle, RotateCcw, Zap, ArrowUpDown, Calendar, ChevronRight, Lock } from 'lucide-react'
import { getViewedSeason } from '@/lib/view-season'

export default async function EventsPage() {
  const viewed = await getViewedSeason()
  const viewingPast = !!viewed && viewed.status !== 'active'

  const formats = [
    {
      icon: <Shuffle className="h-6 w-6 text-neon-green" />,
      name: 'Americano',
      description: 'Rotating partners each round. Points accumulate individually — every player competes with and against everyone.',
      tag: 'Team rotation',
      href: '/events/americano',
    },
    {
      icon: <RotateCcw className="h-6 w-6 text-neon-blue" />,
      name: 'Round Robin',
      description: 'Fixed partners, every team plays every team once. First to 4/6/8 games per match.',
      tag: 'Full schedule',
      href: '/events/round-robin',
    },
    {
      icon: <ArrowUpDown className="h-6 w-6 text-purple-400" />,
      name: 'Snake and Ladders',
      description: '8 players, 2 courts. Win and climb to the top court, lose and slide to the bottom — final round decides 1st through 4th.',
      tag: 'Ladder',
      href: '/events/snake-ladders',
    },
    {
      icon: <Zap className="h-6 w-6 text-yellow-400" />,
      name: 'One Point',
      description: 'Seeded 8-player knockout. Every match is sudden death — one point decides it.',
      tag: 'Knockout',
      href: '/events/one-point',
    },
  ]

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-6 w-6 text-neon-green" />
        <h1 className="text-2xl font-black tracking-tight">Events</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Alternative match formats — pick a format to create and track a new event.
      </p>

      {viewingPast && (
        <Link
          href={`/seasons/${viewed!.id}`}
          className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{viewed!.name} events</div>
            <div className="text-xs text-muted-foreground">Every event from this closed season, read-only.</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        </Link>
      )}

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formats</h2>

        {formats.map(({ icon, name, description, tag, href }) => {
          const content = (
            <>
              <div className="shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground font-medium">
                    {tag}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
              {!href && (
                <div className="shrink-0 text-[10px] text-muted-foreground/50 font-medium mt-0.5">Soon</div>
              )}
            </>
          )

          if (href) {
            return (
              <Link
                key={name}
                href={href}
                className="glass rounded-xl p-4 flex items-start gap-4 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                {content}
              </Link>
            )
          }

          return (
            <div key={name} className="glass rounded-xl p-4 flex items-start gap-4 opacity-80">
              {content}
            </div>
          )
        })}
      </div>

      <div className="flex justify-center pt-2 pb-4">
        <Link
          href="/seasons"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <Calendar className="h-3 w-3" />
          Browse past seasons
        </Link>
      </div>
    </div>
  )
}
