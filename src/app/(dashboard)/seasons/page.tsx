import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'
import { listSeasons, getMatchCount, getEventCount } from '@/lib/store'

export const revalidate = 0

export default async function SeasonsPage() {
  const seasons = await listSeasons()
  const rows = await Promise.all(
    seasons.map(async season => ({
      season,
      matches: await getMatchCount(season.id),
      events: await getEventCount(season.id),
    }))
  )

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-neon-green" />
        <h1 className="text-2xl font-black tracking-tight">Seasons</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Every tour, past and present. Closed seasons are frozen exactly as they finished.
      </p>

      <div className="space-y-3">
        {rows.map(({ season, matches, events }) => (
          <Link
            key={season.id}
            href={`/seasons/${season.id}`}
            className="glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{season.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                    season.status === 'active' ? 'bg-neon-green/15 text-neon-green' : 'bg-white/10 text-muted-foreground'
                  }`}
                >
                  {season.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {matches} matches · {events} events
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
