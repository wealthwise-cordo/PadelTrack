'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpDown, MapPin, Minus, Plus, History, ChevronRight, ChevronDown, Trophy } from 'lucide-react'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import RosterBuilder from '@/components/events/RosterBuilder'
import type { PlayerWithStats } from '@/types'
import type { SnakeLaddersEventSummary } from '@/lib/snake-ladders-store'
import { SNAKE_LADDERS_MAX_COURTS, snakeLaddersPlayers } from '@/lib/snake-ladders'

interface Props {
  players: PlayerWithStats[]
  knownPlayers: PlayerWithStats[]
  pastEvents: SnakeLaddersEventSummary[]
  meId: string
}

type ScoreMode = 'points' | 'games'

const MODE_CONFIG: Record<ScoreMode, { label: string; default: number; min: number; max: number; step: number }> = {
  points: { label: 'Points', default: 21, min: 4, max: 40, step: 1 },
  games: { label: 'Games', default: 6, min: 1, max: 12, step: 1 },
}

const ROUNDS_CONFIG = { default: 4, min: 2, max: 8, step: 1 }

export default function SnakeLaddersSetup({ players, knownPlayers, pastEvents, meId }: Props) {
  // Courts set the number of players: 4 a court.
  const [courts, setCourts] = useState(2)
  const [roster, setRoster] = useState<PlayerWithStats[]>(() => players.filter(p => p.id === meId))
  const router = useRouter()
  const [mode, setMode] = useState<ScoreMode>('points')
  const [target, setTarget] = useState(MODE_CONFIG.points.default)
  const [totalRounds, setTotalRounds] = useState(ROUNDS_CONFIG.default)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = new Map([...knownPlayers, ...players].map(p => [p.id, p]))
  const needed = snakeLaddersPlayers(courts)
  const ready = roster.length === needed
  const places = needed / 2
  const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
  const changeCourts = (n: number) => {
    setCourts(n)
    setRoster(r => r.slice(0, snakeLaddersPlayers(n)))
  }

  const changeMode = (next: ScoreMode) => {
    setMode(next)
    setTarget(MODE_CONFIG[next].default)
  }

  const { min, max, step } = MODE_CONFIG[mode]
  const adjustTarget = (delta: number) => setTarget(t => Math.min(max, Math.max(min, t + delta)))
  const adjustRounds = (delta: number) =>
    setTotalRounds(r => Math.min(ROUNDS_CONFIG.max, Math.max(ROUNDS_CONFIG.min, r + delta)))

  const deleteEvent = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/events/snake-ladders/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const startEvent = async () => {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/events/snake-ladders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: roster.map(p => p.id), scoreMode: mode, target, totalRounds, courts }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start event')
        setStarting(false)
        return
      }
      router.push(`/events/snake-ladders/${data.id}`)
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
          <ArrowUpDown className="h-5 w-5 text-zinc-600" />
          <h1 className="text-2xl font-black tracking-tight">Snake and Ladders</h1>
        </div>
      </div>

      {/* Courts — sets the number of players */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courts</div>
        <label className="relative block">
          <span className="sr-only">Courts</span>
          <select
            value={courts}
            onChange={e => changeCourts(Number(e.target.value))}
            className="w-full appearance-none py-2.5 pl-3 pr-8 rounded-xl text-sm font-bold bg-zinc-600 text-white focus:outline-none"
          >
            {Array.from({ length: SNAKE_LADDERS_MAX_COURTS }, (_, i) => i + 1).map(n => (
              <option key={n} value={n} className="text-zinc-900">
                {n} court{n > 1 ? 's' : ''} · {snakeLaddersPlayers(n)} players
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
        </label>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {courts === 1
              ? 'One court of 4: partners swap every round. The final round decides 1st and 2nd.'
              : `Court 1 is the top. Winners climb a court, losers slide down one — partners get reshuffled every round. The final round decides 1st through ${ordinal(places)}.`}
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
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
              }`}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => adjustTarget(-step)}
            disabled={target <= min}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center min-w-[4.5rem]">
            <span className="text-3xl font-black font-mono tabular-nums">{target}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              first to {mode === 'points' ? 'points' : 'games'}
            </span>
          </div>
          <button
            onClick={() => adjustTarget(step)}
            disabled={target >= max}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Rounds */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number of Rounds</div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => adjustRounds(-ROUNDS_CONFIG.step)}
            disabled={totalRounds <= ROUNDS_CONFIG.min}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center min-w-[4.5rem]">
            <span className="text-3xl font-black font-mono tabular-nums">{totalRounds}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">rounds</span>
          </div>
          <button
            onClick={() => adjustRounds(ROUNDS_CONFIG.step)}
            disabled={totalRounds >= ROUNDS_CONFIG.max}
            className="h-11 w-11 rounded-xl bg-zinc-900/5 border border-zinc-900/10 flex items-center justify-center hover:bg-zinc-900/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Round {totalRounds} decides final placement — 1st through {ordinal(places)}
        </div>
      </div>

      <RosterBuilder players={players} roster={roster} onChange={setRoster} max={needed} hint={`${needed} · seeded by rating`} valid={ready} />

      {error && <div className="text-sm text-red-600 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || !ready}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-600 text-white hover:bg-zinc-600/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {starting ? 'Seeding courts...' : 'Start Event'}
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
              const firstPlace = e.firstPlaceIds?.map(id => byId.get(id)).filter(Boolean) as PlayerWithStats[] | undefined
              const card = (
                <Link
                  href={`/events/snake-ladders/${e.id}`}
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
                            ? 'bg-zinc-600/15 text-zinc-600'
                            : 'bg-amber-600/15 text-amber-600'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Round ${e.currentRound}/${e.totalRounds}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {firstPlace && firstPlace.length === 2 ? (
                        <>
                          <Trophy className="h-3 w-3 text-zinc-600" />
                          <span className="text-zinc-900/70 font-medium">
                            {firstPlace[0].name.split(' ')[0]} &amp; {firstPlace[1].name.split(' ')[0]}
                          </span>{' '}
                          won
                        </>
                      ) : (
                        'In progress'
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
