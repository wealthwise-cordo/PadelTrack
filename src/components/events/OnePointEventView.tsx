'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { ONE_POINT_ROUND_NAMES } from '@/lib/one-point'
import type { PlayerWithStats } from '@/types'
import type { OnePointEventView as EventData, OnePointMatchView } from '@/lib/one-point-store'

interface Props {
  event: EventData
  players: PlayerWithStats[]
}

export default function OnePointEventView({ event, players }: Props) {
  const router = useRouter()
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const byId = new Map(players.map(p => [p.id, p]))
  const player = (id: string | null) => (id ? byId.get(id) : undefined)
  const firstName = (id: string | null) => player(id)?.name.split(' ')[0] ?? 'TBD'

  const ready = (m: OnePointMatchView) => m.player1Id !== null && m.player2Id !== null
  const pendingReady = event.matches.filter(m => m.status === 'pending' && ready(m)).sort((a, b) => a.sequence - b.sequence)
  const current = pendingReady[0]
  const next = pendingReady[1]

  const champion = event.status === 'complete' ? player(event.matches.find(m => m.round === 3)?.winnerId ?? null) : undefined

  // Each player appears in the bracket once per round they survive to —
  // the champion and runner-up show up in all three. Only their last
  // appearance (the final match they actually played) should carry the
  // PTR delta, so it's shown exactly once per player.
  const lastRoundForPlayer = new Map<string, number>()
  for (const m of event.matches) {
    for (const id of [m.player1Id, m.player2Id]) {
      if (!id) continue
      if ((lastRoundForPlayer.get(id) ?? 0) < m.round) lastRoundForPlayer.set(id, m.round)
    }
  }
  const deltaFor = (id: string | null, round: number) =>
    id && lastRoundForPlayer.get(id) === round ? event.ptrDeltas?.[id] : undefined

  // Tennis-draw grid geometry: column 1/3/5 hold QF/SF/Final match boxes,
  // columns 2/4 hold the connector lines between them. Row 1 is the round
  // headers; rows 2-9 are the 8 original bracket slots. A round-`r` match
  // always occupies exactly half of its next round's row-span, centred —
  // that's what keeps the bracket visually correct at every depth.
  const ROUND_COLUMN: Record<number, number> = { 1: 1, 2: 3, 3: 5 }
  const bracketRow = (round: number, position: number) => {
    const span = 2 ** round
    const start = (position - 1) * span + 2
    return { start, span }
  }

  const submitWinner = async () => {
    if (!current || !selectedWinner) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/one-point/${event.id}/matches/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId: selectedWinner }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save')
      } else {
        setSelectedWinner(null)
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const BracketPlayerRow = ({
    id,
    isWinner,
    isDecided,
    delta,
  }: {
    id: string | null
    isWinner: boolean
    isDecided: boolean
    delta: number | undefined
  }) => {
    const p = player(id)
    return (
      <div className={`h-10 flex items-center gap-1.5 px-2 min-w-0 ${isDecided && !isWinner ? 'opacity-40' : ''}`}>
        {p ? (
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background shrink-0"
            style={{ backgroundColor: p.avatarColor }}
          >
            {getInitials(p.name)}
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border border-dashed border-white/20 shrink-0" />
        )}
        <span className={`text-[11px] truncate ${isWinner ? 'font-bold text-neon-green' : 'font-medium'}`}>
          {firstName(id)}
        </span>
        {delta !== undefined && (
          <span className={`text-[9px] font-mono font-bold tabular-nums ml-auto shrink-0 ${delta >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
            {delta >= 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
    )
  }

  const BracketConnector = ({ start, span, column }: { start: number; span: number; column: number }) => (
    <div style={{ gridRow: `${start} / span ${span}`, gridColumn: column }} className="relative">
      <div className="absolute left-0 w-1/2 border-t border-r border-b border-white/15" style={{ top: '25%', height: '50%' }} />
      <div className="absolute left-1/2 w-1/2 border-t border-white/15" style={{ top: '50%' }} />
    </div>
  )

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight flex-1">One Point</h1>
        {event.status === 'complete' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 font-bold uppercase tracking-wide">
            Complete
          </span>
        )}
      </div>

      {champion && (
        <div className="text-center text-sm font-bold text-yellow-400 py-2">
          🏆 {champion.name} wins the One Point tournament!
        </div>
      )}

      {/* Draw */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Draw</span>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <div
            className="grid"
            style={{
              gridTemplateColumns: '124px 24px 124px 24px 124px',
              gridTemplateRows: '22px repeat(8, 40px)',
              minWidth: 420,
            }}
          >
            <div style={{ gridRow: 1, gridColumn: 1 }} className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Quarterfinals
            </div>
            <div style={{ gridRow: 1, gridColumn: 3 }} className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Semifinals
            </div>
            <div style={{ gridRow: 1, gridColumn: 5 }} className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Final
            </div>

            {event.matches.map(m => {
              const { start, span } = bracketRow(m.round, m.position)
              if (m.round > 1) {
                const connectorColumn = ROUND_COLUMN[m.round] - 1
                return (
                  <BracketConnector key={`c-${m.id}`} start={start} span={span} column={connectorColumn} />
                )
              }
              return null
            })}

            {event.matches.map(m => {
              const { start, span } = bracketRow(m.round, m.position)
              return (
                <div key={m.id} style={{ gridRow: `${start} / span ${span}`, gridColumn: ROUND_COLUMN[m.round] }} className="flex items-center">
                  <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
                    <BracketPlayerRow
                      id={m.player1Id}
                      isWinner={!!m.winnerId && m.winnerId === m.player1Id}
                      isDecided={m.status === 'complete'}
                      delta={deltaFor(m.player1Id, m.round)}
                    />
                    <div className="border-t border-white/5" />
                    <BracketPlayerRow
                      id={m.player2Id}
                      isWinner={!!m.winnerId && m.winnerId === m.player2Id}
                      isDecided={m.status === 'complete'}
                      delta={deltaFor(m.player2Id, m.round)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Current match */}
      {current && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-yellow-400/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ONE_POINT_ROUND_NAMES[current.round]}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">One point wins</span>
          </div>

          {[current.player1Id, current.player2Id].map(id => {
            const p = player(id)
            if (!p) return null
            const selected = selectedWinner === id
            return (
              <button
                key={id}
                onClick={() => setSelectedWinner(id!)}
                className={`w-full flex items-center gap-3 h-14 px-3 rounded-xl border transition-all ${
                  selected ? 'border-yellow-400/60 bg-yellow-400/10' : 'border-white/15 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-background shrink-0"
                  style={{ backgroundColor: p.avatarColor, boxShadow: selected ? `0 0 12px ${p.avatarColor}66` : 'none' }}
                >
                  {getInitials(p.name)}
                </div>
                <span className="text-sm font-semibold flex-1 text-left">{p.name.split(' ')[0]}</span>
                {selected && <span className="text-[10px] font-bold text-yellow-400 uppercase">Winner</span>}
              </button>
            )
          })}

          {error && <div className="text-xs text-red-400 text-center">{error}</div>}

          <button
            onClick={submitWinner}
            disabled={submitting || !selectedWinner}
            className="w-full py-3 rounded-xl font-bold text-sm bg-yellow-400 text-background hover:bg-yellow-400/90 disabled:opacity-40 transition-all"
          >
            {submitting ? 'Saving...' : 'Confirm Winner'}
          </button>
        </div>
      )}

      {/* Up next */}
      {next && (
        <div className="glass rounded-xl p-3 opacity-70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Up Next</span>
            <span className="text-[10px] font-mono text-muted-foreground">{ONE_POINT_ROUND_NAMES[next.round]}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold truncate">{firstName(next.player1Id)}</span>
            <span className="text-[10px] font-black text-white/25 shrink-0">VS</span>
            <span className="text-xs font-semibold truncate text-right">{firstName(next.player2Id)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
