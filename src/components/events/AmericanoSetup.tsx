'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Shuffle, Minus, Plus, MapPin, History, ChevronRight } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import type { PlayerWithStats } from '@/types'
import type { AmericanoEventSummary } from '@/lib/americano-store'

interface Props {
  players: PlayerWithStats[]
  pastEvents: AmericanoEventSummary[]
}

type ScoreMode = 'points' | 'games'
type RosterMode = 'full' | 'seven' | 'five' | 'half'

const MODE_CONFIG: Record<ScoreMode, { label: string; default: number; min: number; max: number; step: number }> = {
  points: { label: 'Points', default: 21, min: 4, max: 40, step: 1 },
  games: { label: 'Games', default: 6, min: 1, max: 12, step: 1 },
}

const ROSTER_CONFIG: Record<RosterMode, { label: string; count: number }> = {
  full: { label: '8', count: 8 },
  seven: { label: '7', count: 7 },
  five: { label: '5', count: 5 },
  half: { label: '4', count: 4 },
}

export default function AmericanoSetup({ players, pastEvents }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<ScoreMode>('points')
  const [target, setTarget] = useState(MODE_CONFIG.points.default)
  const [rosterMode, setRosterMode] = useState<RosterMode>('full')
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const changeMode = (next: ScoreMode) => {
    setMode(next)
    setTarget(MODE_CONFIG[next].default)
  }

  const changeRosterMode = (next: RosterMode) => {
    setRosterMode(next)
    setExcludedIds([])
  }

  const { min, max, step } = MODE_CONFIG[mode]
  const adjust = (delta: number) => setTarget(t => Math.min(max, Math.max(min, t + delta)))
  const byId = new Map(players.map(p => [p.id, p]))

  const targetCount = ROSTER_CONFIG[rosterMode].count
  const maxExclusions = players.length - targetCount
  const included = players.filter(p => !excludedIds.includes(p.id))

  const toggleExclude = (id: string) => {
    if (rosterMode === 'full') return
    setExcludedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxExclusions) return prev
      return [...prev, id]
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
        body: JSON.stringify({ playerIds: included.map(p => p.id), scoreMode: mode, target }),
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
          className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-neon-green" />
          <h1 className="text-2xl font-black tracking-tight">Americano</h1>
        </div>
      </div>

      {/* Court */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-neon-green/10 flex items-center justify-center shrink-0">
          <MapPin className="h-5 w-5 text-neon-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">1 Court</div>
          <div className="text-xs text-muted-foreground">All rounds played on a single court</div>
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
                  ? 'bg-neon-green text-background'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
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
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Roster size */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roster</div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(ROSTER_CONFIG) as RosterMode[]).map(m => (
            <button
              key={m}
              onClick={() => changeRosterMode(m)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                rosterMode === m
                  ? 'bg-neon-green text-background'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {ROSTER_CONFIG[m].label}
            </button>
          ))}
        </div>
        {rosterMode !== 'full' && (
          <div className="text-[11px] text-muted-foreground text-center">
            Tap {maxExclusions} player{maxExclusions === 1 ? '' : 's'} to sit out — {excludedIds.length}/{maxExclusions} selected
          </div>
        )}
      </div>

      {/* Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</span>
          <span className="text-xs text-muted-foreground font-mono">
            {included.length}/{targetCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {players.map(p => {
            const excluded = excludedIds.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggleExclude(p.id)}
                disabled={rosterMode === 'full'}
                className={`flex items-center gap-2 h-14 px-3 rounded-xl border transition-all ${
                  excluded
                    ? 'border-white/5 bg-white/[0.02] opacity-40'
                    : 'border-white/15 bg-white/5'
                } ${rosterMode === 'full' ? 'cursor-default' : 'hover:bg-white/10'}`}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                  style={{ backgroundColor: p.avatarColor, boxShadow: excluded ? 'none' : `0 0 12px ${p.avatarColor}44` }}
                >
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className={`text-xs font-semibold truncate ${excluded ? 'line-through' : ''}`}>
                    {p.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {excluded ? 'Sitting out' : formatPTR(p.ptr)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || players.length !== 8 || included.length !== targetCount}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                  className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">
                        {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                          e.status === 'complete'
                            ? 'bg-neon-green/15 text-neon-green'
                            : 'bg-yellow-400/15 text-yellow-400'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Round ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {leaderPlayer ? (
                        <>
                          <span className="text-white/70 font-medium">{leaderPlayer.name.split(' ')[0]}</span> leads
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
