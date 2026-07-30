'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, MapPin, History, ChevronRight } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventSummary } from '@/lib/round-robin-store'

interface Props {
  players: PlayerWithStats[]
  pastEvents: RoundRobinEventSummary[]
}

type TeamCount = 3 | 4
const TARGET_OPTIONS = [4, 6, 8] as const

export default function RoundRobinSetup({ players, pastEvents }: Props) {
  const router = useRouter()
  const [teamCount, setTeamCount] = useState<TeamCount>(4)
  const [target, setTarget] = useState<(typeof TARGET_OPTIONS)[number]>(6)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isRanked, setIsRanked] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = new Map(players.map(p => [p.id, p]))
  const needed = teamCount * 2

  const changeTeamCount = (n: TeamCount) => {
    setTeamCount(n)
    setSelectedIds([])
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= needed) return prev
      return [...prev, id]
    })
  }

  const teams: [string, string][] = []
  for (let i = 0; i < selectedIds.length; i += 2) {
    if (selectedIds[i + 1]) teams.push([selectedIds[i], selectedIds[i + 1]])
  }
  const teamIndexForPlayer = new Map<string, number>()
  selectedIds.forEach((id, i) => teamIndexForPlayer.set(id, Math.floor(i / 2)))

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
        body: JSON.stringify({ teams, target, isRanked }),
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
          className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0"
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
                  ? 'bg-neon-blue text-background'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
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
                  ? 'bg-neon-blue text-background'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {n} teams
            </button>
          ))}
        </div>
      </div>

      {/* Players -> teams */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tap players in pairs to build teams
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {selectedIds.length}/{needed}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {players.map(p => {
            const selected = selectedIds.includes(p.id)
            const teamIdx = teamIndexForPlayer.get(p.id)
            const disabled = !selected && selectedIds.length >= needed
            return (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                disabled={disabled}
                className={`relative flex items-center gap-2 h-14 px-3 rounded-xl border transition-all ${
                  selected
                    ? 'border-neon-blue/50 bg-neon-blue/10'
                    : 'border-white/15 bg-white/5'
                } ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                  style={{ backgroundColor: p.avatarColor, boxShadow: selected ? `0 0 12px ${p.avatarColor}44` : 'none' }}
                >
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-semibold truncate">{p.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{formatPTR(p.ptr)}</div>
                </div>
                {teamIdx !== undefined && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded-full bg-neon-blue text-background font-bold">
                    T{teamIdx + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Team preview */}
      {teams.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Teams</div>
          {teams.map((team, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-6 shrink-0 font-mono text-muted-foreground">T{i + 1}</span>
              <span className="font-semibold">
                {byId.get(team[0])?.name.split(' ')[0]} &amp; {byId.get(team[1])?.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ranked / unranked */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match Type</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsRanked(true)}
            className={`py-2 rounded-xl text-sm font-bold transition-all ${
              isRanked ? 'bg-neon-blue text-background' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Ranked
          </button>
          <button
            onClick={() => setIsRanked(false)}
            className={`py-2 rounded-xl text-sm font-bold transition-all ${
              !isRanked ? 'bg-neon-blue text-background' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Unranked
          </button>
        </div>
        {!isRanked && (
          <div className="text-[10px] text-muted-foreground text-center">
            Event still plays out and saves normally — PTR won&apos;t change
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || selectedIds.length !== needed}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-blue text-background hover:bg-neon-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                            ? 'bg-neon-blue/15 text-neon-blue'
                            : 'bg-yellow-400/15 text-yellow-400'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Match ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                      {!e.isRanked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-white/10 text-muted-foreground">
                          Unranked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {leader ? (
                        <>
                          <span className="text-white/70 font-medium">
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
