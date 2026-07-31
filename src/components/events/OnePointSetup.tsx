'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Swords, History, ChevronRight, Trophy } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import type { PlayerWithStats } from '@/types'
import type { OnePointEventSummary } from '@/lib/one-point-store'

interface Props {
  players: PlayerWithStats[]
  pastEvents: OnePointEventSummary[]
}

export default function OnePointSetup({ players, pastEvents }: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = new Map(players.map(p => [p.id, p]))
  const ready = players.length === 8

  const deleteEvent = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/events/one-point/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const startEvent = async () => {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/events/one-point', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start tournament')
        setStarting(false)
        return
      }
      router.push(`/events/one-point/${data.id}`)
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
          <Zap className="h-5 w-5 text-yellow-400" />
          <h1 className="text-2xl font-black tracking-tight">One Point</h1>
        </div>
      </div>

      {/* Format */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
          <Swords className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Sudden-death knockout</div>
          <div className="text-xs text-muted-foreground">
            All 8 players, singles, one point decides each match — no score needed
          </div>
        </div>
      </div>

      {/* Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</span>
          <span className="text-xs text-muted-foreground font-mono">{players.length}/8</span>
        </div>
        {!ready && (
          <div className="text-[11px] text-yellow-400/80 text-center py-1">
            One Point requires exactly 8 registered players ({players.length} currently)
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {players.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-2 h-14 px-3 rounded-xl border border-white/15 bg-white/5"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                style={{ backgroundColor: p.avatarColor, boxShadow: `0 0 12px ${p.avatarColor}44` }}
              >
                {getInitials(p.name)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold truncate">{p.name.split(' ')[0]}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{formatPTR(p.ptr)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || !ready}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-yellow-400 text-background hover:bg-yellow-400/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {starting ? 'Seeding draw...' : 'Start Tournament'}
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
              const champion = e.championId ? byId.get(e.championId) : undefined
              const card = (
                <Link
                  href={`/events/one-point/${e.id}`}
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
                            ? 'bg-yellow-400/15 text-yellow-400'
                            : 'bg-white/10 text-muted-foreground'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Match ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {champion ? (
                        <>
                          <Trophy className="h-3 w-3 text-yellow-400" />
                          <span className="text-white/70 font-medium">{champion.name.split(' ')[0]}</span> won
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
