import Link from 'next/link'
import { LayoutGrid, Shuffle, RotateCcw, Zap } from 'lucide-react'

export default function EventsPage() {
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
    </div>
  )
}
