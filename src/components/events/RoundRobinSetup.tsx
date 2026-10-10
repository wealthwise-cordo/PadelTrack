'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, MapPin, History, ChevronRight } from 'lucide-react'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import RosterBuilder from '@/components/events/RosterBuilder'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventSummary } from '@/lib/round-robin-store'

interface Props {
  players: PlayerWithStats[]
  knownPlayers: PlayerWithStats[]
  pastEvents: RoundRobinEventSummary[]
  meId: string
}

type TeamCount = 3 | 4
const TARGET_OPTIONS = [4, 6, 8] as const

export default function RoundRobinSetup({ players, knownPlayers, pastEvents, meId }: Props) {
  const router = useRouter()
  const [teamCount, setTeamCount] = useState<TeamCount>(4)
  const [target, setTarget] = useState<(typeof TARGET_OPTIONS)[number]>(6)
  const [roster, setRoster] = useState<PlayerWithStats[]>(() => players.filter(p => p.id === meId))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = new Map([...knownPlayers, ...players].map(p => [p.id, p]))
  const needed = teamCount * 2

  const changeTeamCount = (n: TeamCount) => {
    setTeamCount(n)
    setRoster(r => r.slice(0, n * 2))
  }

  // Players are paired in the order they're added: 1st & 2nd form team 1,
  // 3rd & 4th team 2, and so on.
  const teams: [string, string][] = []
  for (let i = 0; i + 1 < roster.length; i += 2) teams.push([roster[i].id, roster[i + 1].id])

  const deleteEvent = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/events/round-robin/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const startEvent = async () => {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/events/round-robin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams, target }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start event')
        setStarting(false)
        return
      }
      router.push(`/events/round-robin/${data.id}`)
    } catch {
      setError('Network error')
      setStarting(false)
    }
  }

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-neon-blue" />
          <h1 className="text-2xl font-black tracking-tight">Round Robin</h1>
        </div>
      </div>

      {/* Court */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-neon-blue/10 flex items-center justify-center shrink-0">
          <MapPin className="h-5 w-5 text-neon-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">1 Court</div>
          <div className="text-xs text-muted-foreground">Fixed partners — every team plays every team once</div>
        </div>
      </div>

      {/* Games target */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First to</div>
        <div className="grid grid-cols-3 gap-2">
          {TARGET_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                target === t
                  ? 'bg-neon-blue text-white'
                  : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
              }`}
            >
              {t} games
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Race to {target} — not best of, first team to {target} wins the match
        </div>
      </div>

      {/* Team count */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teams</div>
        <div className="grid grid-cols-2 gap-2">
          {([3, 4] as TeamCount[]).map(n => (
            <button
              key={n}
              onClick={() => changeTeamCount(n)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                teamCount === n
                  ? 'bg-neon-blue text-white'
                  : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
              }`}
            >
              {n} teams
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <RosterBuilder players={players} roster={roster} onChange={setRoster} max={needed} hint={`${needed} — each row is a team`} valid={roster.length === needed} />
        {teams.length > 0 && (
          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Teams</div>
            {teams.map((team, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 font-mono text-zinc-500">T{i + 1}</span>
                <span className="font-semibold">
                  {byId.get(team[0])?.name.split(' ')[0]} &amp; {byId.get(team[1])?.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || roster.length !== needed}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-blue text-white hover:bg-neon-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {starting ? 'Generating schedule...' : 'Start Event'}
      </button>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Events</span>
          </div>
          <div className="space-y-2">
            {pastEvents.map(e => {
              const leader = e.leaderboard[0]
              const card = (
                <Link
                  href={`/events/round-robin/${e.id}`}
                  className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-zinc-900/10 hover:border-zinc-900/20 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">
                        {new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                          e.status === 'complete'
                            ? 'bg-neon-blue/15 text-neon-blue'
                            : 'bg-amber-600/15 text-amber-600'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Match ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {leader ? (
                        <>
                          <span className="text-zinc-900/70 font-medium">
                            {byId.get(leader.playerIds[0])?.name.split(' ')[0]} &amp;{' '}
                            {byId.get(leader.playerIds[1])?.name.split(' ')[0]}
                          </span>{' '}
                          leads with {leader.points} pts
                        </>
                      ) : (
                        'No scores yet'
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </Link>
              )

              if (e.status === 'in_progress') {
                return (
                  <SwipeToDeleteRow key={e.id} onDelete={() => deleteEvent(e.id)} deleting={deletingId === e.id}>
                    {card}
                  </SwipeToDeleteRow>
                )
              }
              return <div key={e.id}>{card}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
