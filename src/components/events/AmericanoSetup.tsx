'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Shuffle, Minus, Plus, MapPin, History, ChevronRight, ChevronDown } from 'lucide-react'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import RosterBuilder from '@/components/events/RosterBuilder'
import type { PlayerWithStats } from '@/types'
import type { AmericanoEventSummary } from '@/lib/americano-store'
import { AMERICANO_SIZES, AMERICANO_MAX_COURTS, americanoMaxCourts, generateAmericanoSchedule } from '@/lib/americano'

interface Props {
  players: PlayerWithStats[]
  knownPlayers: PlayerWithStats[]
  pastEvents: AmericanoEventSummary[]
  meId: string
}

type ScoreMode = 'points' | 'games'
const MODE_CONFIG: Record<ScoreMode, { label: string; default: number; min: number; max: number; step: number }> = {
  points: { label: 'Points', default: 21, min: 4, max: 40, step: 1 },
  games: { label: 'Games', default: 6, min: 1, max: 12, step: 1 },
}

export default function AmericanoSetup({ players, knownPlayers, pastEvents, meId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<ScoreMode>('points')
  const [target, setTarget] = useState(MODE_CONFIG.points.default)
  const [playerCount, setPlayerCount] = useState(8)
  const [courts, setCourts] = useState(1)
  const [roster, setRoster] = useState<PlayerWithStats[]>(() => players.filter(p => p.id === meId))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const changeMode = (next: ScoreMode) => {
    setMode(next)
    setTarget(MODE_CONFIG[next].default)
  }

  const { min, max, step } = MODE_CONFIG[mode]
  const adjust = (delta: number) => setTarget(t => Math.min(max, Math.max(min, t + delta)))
  const byId = new Map([...knownPlayers, ...players].map(p => [p.id, p]))

  const rosterValid = roster.length === playerCount
  // More courts than players allow (4 a court) can't be used.
  const maxCourts = americanoMaxCourts(playerCount)
  const courtsInUse = Math.min(courts, maxCourts)
  const rounds = useMemo(() => {
    const ids = Array.from({ length: playerCount }, (_, i) => String(i))
    return Math.max(...generateAmericanoSchedule(ids, courtsInUse).map(f => f.round))
  }, [playerCount, courtsInUse])
  const sitting = playerCount - courtsInUse * 4

  // Steps through the allowed counts (4–24, skipping 7, 11, 15, 19 and 23).
  // Fewer players drops anyone beyond the new size.
  const changeCount = (dir: 1 | -1) => {
    setPlayerCount(current => {
      const i = AMERICANO_SIZES.indexOf(current) + dir
      const next = AMERICANO_SIZES[Math.min(AMERICANO_SIZES.length - 1, Math.max(0, i))]
      setRoster(r => r.slice(0, next))
      return next
    })
  }

  const deleteEvent = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/events/americano/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const startEvent = async () => {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/events/americano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: roster.map(p => p.id), scoreMode: mode, target, courts: courtsInUse }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start event')
        setStarting(false)
        return
      }
      router.push(`/events/americano/${data.id}`)
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
          <Shuffle className="h-5 w-5 text-neon-green" />
          <h1 className="text-2xl font-black tracking-tight">Americano</h1>
        </div>
      </div>

      {/* Number of players, then courts */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number of players</div>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => changeCount(-1)}
            disabled={playerCount <= AMERICANO_SIZES[0]}
            aria-label="Fewer players"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 disabled:opacity-30 transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="text-xl font-black tabular-nums">{playerCount} players</div>
            <div className="text-[11px] text-muted-foreground">Everyone partners everyone{playerCount % 4 === 2 ? ' (one pair twice)' : ''}</div>
          </div>
          <button
            onClick={() => changeCount(1)}
            disabled={playerCount >= AMERICANO_SIZES[AMERICANO_SIZES.length - 1]}
            aria-label="More players"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 disabled:opacity-30 transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courts</div>
        <label className="relative block">
          <span className="sr-only">Courts</span>
          <select
            value={courtsInUse}
            onChange={e => setCourts(Number(e.target.value))}
            className="w-full appearance-none py-2.5 pl-3 pr-8 rounded-xl text-sm font-bold bg-neon-green text-white focus:outline-none"
          >
            {Array.from({ length: AMERICANO_MAX_COURTS }, (_, i) => i + 1).map(n => (
              <option key={n} value={n} disabled={n > maxCourts} className="text-zinc-900">
                {n} court{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
        </label>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {rounds} rounds · {courtsInUse * 4} playing each round{sitting > 0 ? `, ${sitting} sitting out (taking turns)` : ''}
          </span>
        </div>
      </div>

      {/* Score target */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playing to</div>

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MODE_CONFIG) as ScoreMode[]).map(m => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-neon-green text-white'
                  : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
              }`}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => adjust(-step)}
            disabled={target <= min}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center min-w-[4.5rem]">
            <span className="text-3xl font-black font-mono tabular-nums">{target}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {mode === 'points' ? 'points / round' : 'games / round'}
            </span>
          </div>
          <button
            onClick={() => adjust(step)}
            disabled={target >= max}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <RosterBuilder players={players} roster={roster} onChange={setRoster} max={playerCount} hint={`${playerCount}`} valid={rosterValid} />

      {error && <div className="text-sm text-red-600 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || !rosterValid}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-green text-white hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
              const leaderPlayer = leader ? byId.get(leader.playerId) : undefined
              const card = (
                <Link
                  href={`/events/americano/${e.id}`}
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
                            ? 'bg-neon-green/15 text-neon-green'
                            : 'bg-amber-600/15 text-amber-600'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Round ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {leaderPlayer ? (
                        <>
                          <span className="text-zinc-900/70 font-medium">{leaderPlayer.name.split(' ')[0]}</span> leads
                          with {leader!.points} pts
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
