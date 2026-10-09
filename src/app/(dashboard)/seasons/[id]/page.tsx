import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Lock } from 'lucide-react'
import { getSeason, getPlayers, getMatches } from '@/lib/store'
import { listAmericanoEvents } from '@/lib/americano-store'
import { listRoundRobinEvents } from '@/lib/round-robin-store'
import { listOnePointEvents } from '@/lib/one-point-store'
import { listSnakeLaddersEvents } from '@/lib/snake-ladders-store'
import { getInitials, formatPTR } from '@/lib/utils'
import MatchCard from '@/components/matches/MatchCard'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

export default async function SeasonDetailPage({ params }: { params: { id: string } }) {
  const season = await getSeason(params.id)
  if (!season) notFound()

  const [players, matches, americanoEvents, roundRobinEvents, onePointEvents, snakeLaddersEvents] = await Promise.all([
    getPlayers(season.id),
    getMatches(season.id),
    listAmericanoEvents(season.id),
    listRoundRobinEvents(season.id),
    listOnePointEvents(season.id),
    listSnakeLaddersEvents(season.id),
  ])

  const EventRow = ({ href, label, status, sub }: { href: string; label: string; status: string; sub: string }) => (
    <Link href={href} className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold">{label}</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
              status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'
            }`}
          >
            {status === 'complete' ? 'Complete' : 'In progress'}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
    </Link>
  )

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/seasons"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight flex-1">{season.name}</h1>
        {season.status === 'closed' ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground font-bold uppercase tracking-wide flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" /> Closed
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green font-bold uppercase tracking-wide">
            Active
          </span>
        )}
      </div>

      {season.status === 'closed' && (
        <p className="text-xs text-muted-foreground text-center -mt-2">
          This season is frozen — a read-only snapshot of how it finished.
        </p>
      )}

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-neon-green" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Standings</span>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No players.</p>
        ) : (
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-mono text-muted-foreground text-right shrink-0">{i + 1}</span>
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background shrink-0"
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {getInitials(p.name)}
                </div>
                <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{p.wins}W {p.losses}L</span>
                <span className="text-sm font-mono font-bold tabular-nums w-14 text-right">{formatPTR(p.ptr)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matches */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No matches recorded.</p>
        ) : (
          <div className="space-y-3">
            {matches.map(m => <MatchCard key={m.id} match={m as MatchWithPlayers} />)}
          </div>
        )}
      </div>

      {/* Events */}
      {(americanoEvents.length > 0 || roundRobinEvents.length > 0 || onePointEvents.length > 0 || snakeLaddersEvents.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Events</h2>
          <div className="space-y-2">
            {americanoEvents.map(e => (
              <EventRow
                key={e.id}
                href={`/events/americano/${e.id}`}
                label="Americano"
                status={e.status}
                sub={`${e.playerIds.length} players`}
              />
            ))}
            {roundRobinEvents.map(e => (
              <EventRow
                key={e.id}
                href={`/events/round-robin/${e.id}`}
                label="Round Robin"
                status={e.status}
                sub={`${e.teams.length} teams`}
              />
            ))}
            {onePointEvents.map(e => (
              <EventRow
                key={e.id}
                href={`/events/one-point/${e.id}`}
                label="One Point"
                status={e.status}
                sub="8 players"
              />
            ))}
            {snakeLaddersEvents.map(e => (
              <EventRow
                key={e.id}
                href={`/events/snake-ladders/${e.id}`}
                label="Snake and Ladders"
                status={e.status}
                sub="8 players"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
