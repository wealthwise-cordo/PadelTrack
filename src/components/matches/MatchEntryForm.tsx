'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface SetScore {
  teamAGames: number
  teamBGames: number
}

interface Props {
  players: PlayerWithStats[]
}

// slots index: 0 = teamA1, 1 = teamA2, 2 = teamB1, 3 = teamB2
type Slots = [string, string, string, string]

export default function MatchEntryForm({ players }: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slots>(['', '', '', ''])
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)
  const [sets, setSets] = useState<SetScore[]>([{ teamAGames: 0, teamBGames: 0 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [teamA1, teamA2, teamB1, teamB2] = slots
  const allSelected = slots.every(Boolean)

  const getPlayer = (id: string) => players.find(p => p.id === id)

  const availableForSlot = (slotIdx: number) =>
    players.filter(p => !slots.some((id, i) => i !== slotIdx && id === p.id))

  const selectPlayer = (slotIdx: number, playerId: string) => {
    const next = [...slots] as Slots
    next[slotIdx] = playerId
    setSlots(next)
    setPickingSlot(null)
  }

  const clearSlot = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = [...slots] as Slots
    next[slotIdx] = ''
    setSlots(next)
    setPreview(null)
  }

  const determineWinner = (): 'A' | 'B' | null => {
    const setsA = sets.filter(s => s.teamAGames > s.teamBGames).length
    const setsB = sets.filter(s => s.teamBGames > s.teamAGames).length
    if (setsA > setsB) return 'A'
    if (setsB > setsA) return 'B'
    return null
  }

  const handleSubmit = async () => {
    const winner = determineWinner()
    if (!winner) { setError('Match result is unclear — check your scores'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAPlayer1Id: teamA1, teamAPlayer2Id: teamA2, teamBPlayer1Id: teamB1, teamBPlayer2Id: teamB2, sets, winner }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Submission failed')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/'), 2000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-6xl">🏆</div>
        <div className="text-xl font-bold text-neon-green">Match Recorded!</div>
        <div className="text-sm text-muted-foreground">Redirecting to rankings...</div>
      </div>
    )
  }

  const Slot = ({ idx }: { idx: number }) => {
    const player = getPlayer(slots[idx])
    if (player) {
      return (
        <button
          onClick={() => setPickingSlot(idx)}
          className="relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all w-full"
        >
          <button
            onClick={e => clearSlot(idx, e)}
            className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-400/30 transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-background shadow-lg"
            style={{ backgroundColor: player.avatarColor, boxShadow: `0 0 16px ${player.avatarColor}55` }}
          >
            {getInitials(player.name)}
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold leading-tight">{player.name.split(' ')[0]}</div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatPTR(player.ptr)}</div>
          </div>
        </button>
      )
    }
    return (
      <button
        onClick={() => setPickingSlot(idx)}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 hover:border-neon-green/50 hover:bg-neon-green/5 transition-all w-full aspect-square min-h-[110px]"
      >
        <Plus className="h-7 w-7 text-white/30" />
      </button>
    )
  }

  const winner = determineWinner()

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Court layout */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Slot idx={0} />
          <Slot idx={1} />
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] font-black text-white/30 tracking-[0.2em]">VS</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Slot idx={2} />
          <Slot idx={3} />
        </div>
      </div>

      {/* Score */}
      <div className="glass rounded-xl p-4">
        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Score</div>

        {/* Team labels above score inputs — only shown when players are selected */}
        {allSelected && (
          <div className="flex items-center gap-3 mb-2 px-12">
            <div className="flex-1 flex items-center gap-1.5">
              {[teamA1, teamA2].map(id => {
                const p = getPlayer(id)!
                return (
                  <div key={id} className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                    {getInitials(p.name)}
                  </div>
                )
              })}
            </div>
            <div className="w-4" />
            <div className="flex-1 flex items-center justify-end gap-1.5">
              {[teamB1, teamB2].map(id => {
                const p = getPlayer(id)!
                return (
                  <div key={id} className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                    {getInitials(p.name)}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sets.map((set, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12 shrink-0">Set {i + 1}</span>
              <input
                type="number" min={0} max={7} value={set.teamAGames}
                onChange={e => { const v = [...sets]; v[i] = { ...v[i], teamAGames: Number(e.target.value) }; setSets(v) }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-green/50"
              />
              <span className="text-muted-foreground text-xs font-bold">—</span>
              <input
                type="number" min={0} max={7} value={set.teamBGames}
                onChange={e => { const v = [...sets]; v[i] = { ...v[i], teamBGames: Number(e.target.value) }; setSets(v) }}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-green/50"
              />
              {i > 0 && (
                <button onClick={() => setSets(sets.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 text-xs shrink-0">✕</button>
              )}
            </div>
          ))}
        </div>

        {sets.length < 3 && (
          <button onClick={() => setSets([...sets, { teamAGames: 0, teamBGames: 0 }])} className="mt-3 text-xs text-muted-foreground hover:text-neon-green transition-colors">
            + Add set
          </button>
        )}

        {allSelected && winner && (
          <div className="mt-3 text-center text-sm font-bold text-neon-green">
            {getPlayer(winner === 'A' ? teamA1 : teamB1)?.name.split(' ')[0]} &amp; {getPlayer(winner === 'A' ? teamA2 : teamB2)?.name.split(' ')[0]} win
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !winner || !allSelected}
        className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {submitting ? 'Recording Match...' : 'Record Match'}
      </button>

      {/* Player picker bottom sheet */}
      {pickingSlot !== null && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" onClick={() => setPickingSlot(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(222,47%,8%)] border-t border-white/10 rounded-t-3xl p-5 pb-10 max-h-[72vh] overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold">Select Player</span>
              <button onClick={() => setPickingSlot(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {availableForSlot(pickingSlot).map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(pickingSlot, p.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all text-left"
                >
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-background shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {getInitials(p.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.nickname}</div>
                    <div className="text-[10px] font-mono text-white/40">{formatPTR(p.ptr)} PTR</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
