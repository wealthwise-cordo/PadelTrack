import { LayoutGrid, Shuffle, RotateCcw, Zap } from 'lucide-react'

export default function EventsPage() {
  const formats = [
    {
      icon: <Shuffle className="h-6 w-6 text-neon-green" />,
      name: 'Americano',
      description: 'Rotating partners each round. Points accumulate individually — every player competes with and against everyone.',
      tag: 'Team rotation',
    },
    {
      icon: <RotateCcw className="h-6 w-6 text-neon-blue" />,
      name: 'Round Robin',
      description: 'Every pairing plays each other at least once. Best overall record wins.',
      tag: 'Full schedule',
    },
    {
      icon: <Zap className="h-6 w-6 text-yellow-400" />,
      name: 'One Point',
      description: 'Fast-format knockout where every point counts. Single elimination, max intensity.',
      tag: 'Knockout',
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

        {formats.map(({ icon, name, description, tag }) => (
          <div key={name} className="glass rounded-xl p-4 flex items-start gap-4 opacity-80">
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
            <div className="shrink-0 text-[10px] text-muted-foreground/50 font-medium mt-0.5">Soon</div>
          </div>
        ))}
      </div>
    </div>
  )
}
