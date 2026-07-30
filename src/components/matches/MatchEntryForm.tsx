'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { getInitials, formatPTR, setWinner } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface SetScore {
  teamAGames: number
  teamBGames: number
}

interface Props {
  players: PlayerWithStats[]
}

type Slots = [string, string, string, string]

const EMPTY_SETS: SetScore[] = [
  { teamAGames: 0, teamBGames: 0 },
  { teamAGames: 0, teamBGames: 0 },
  { teamAGames: 0, teamBGames: 0 },
]

function matchStatus(sets: SetScore[]): { status: 'complete' | 'incomplete'; winner: 'A' | 'B' | null } {
  const setsA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const setsB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  if (setsA >= 2) return { status: 'complete', winner: 'A' }
  if (setsB >= 2) return { status: 'complete', winner: 'B' }
  return { status: 'incomplete', winner: null }
}

export default function MatchEntryForm({ players }: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slots>(['', '', '', ''])
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)
  const [sets, setSets] = useState<SetScore[]>(EMPTY_SETS)
  const [hasEditedScore, setHasEditedScore] = useState(false)
  const [isRanked, setIsRanked] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // 6 input refs: [s0A, s0B, s1A, s1B, s2A, s2B]
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null])

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
  }

  const updateScore = (setIdx: number, team: 'A' | 'B', val: number) => {
    const v = [...sets]
    if (team === 'A') v[setIdx] = { ...v[setIdx], teamAGames: val }
    else v[setIdx] = { ...v[setIdx], teamBGames: val }
    setSets(v)
    setHasEditedScore(true)
  }

  const focusNext = (refIdx: number) => {
    // Determine the next meaningful input skipping dimmed set 3 inputs
    const played = sets.filter(s => s.teamAGames + s.teamBGames > 0)
    const setsA1 = played.filter(s => s.teamAGames > s.teamBGames).length
    const setsB1 = played.filter(s => s.teamBGames > s.teamAGames).length
    const thirdActive = (setsA1 === 1 && setsB1 === 1) || sets[2].teamAGames + sets[2].teamBGames > 0
    const lastActive = thirdActive ? 5 : 3
    if (refIdx >= lastActive) {
      inputRefs.current[refIdx]?.blur()
    } else {
      inputRefs.current[refIdx + 1]?.focus()
    }
  }

  const { status, winner } = matchStatus(sets)

  const completedA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const completedB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  const thirdSetActive = true

  const handleSubmit = async () => {
    if (!allSelected) { setError('Select all four players first'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAPlayer1Id: teamA1, teamAPlayer2Id: teamA2,
          teamBPlayer1Id: teamB1, teamBPlayer2Id: teamB2,
          sets, winner, status, isRanked,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Submission failed')
      } else {
        setSaved(true)
        setTimeout(() => router.push('/matches'), 1500)
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-6xl">{status === 'complete' ? '🏆' : '⏸️'}</div>
        <div className="text-xl font-bold text-neon-green">Match Saved!</div>
      </div>
    )
  }

  const Slot = ({ idx }: { idx: number }) => {
    const player = getPlayer(slots[idx])
    if (player) {
      return (
        <button
          onClick={() => setPickingSlot(idx)}
          className="relative flex items-center gap-2 h-14 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-all w-full"
        >
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
            style={{ backgroundColor: player.avatarColor, boxShadow: `0 0 12px ${player.avatarColor}44` }}
          >
            {getInitials(player.name)}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-xs font-semibold truncate">{player.name.split(' ')[0]}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{formatPTR(player.ptr)}</div>
          </div>
          <button
            onClick={e => clearSlot(idx, e)}
            className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-400/30 transition-colors shrink-0"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </button>
      )
    }
    return (
      <button
        onClick={() => setPickingSlot(idx)}
        className="flex items-center justify-center h-14 rounded-xl border-2 border-dashed border-white/20 hover:border-neon-green/50 hover:bg-neon-green/5 transition-all w-full"
      >
        <Plus className="h-5 w-5 text-white/30" />
      </button>
    )
  }

  return (
    <div className="pt-5 space-y-4">

      {/* Page title */}
      <h1 className="text-2xl font-black tracking-tight">Record Match</h1>

      {/* Court layout — compact */}
      <div className="glass rounded-2xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Slot idx={0} />
          <Slot idx={1} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-black text-white/25 tracking-[0.2em]">VS</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Slot idx={2} />
          <Slot idx={3} />
        </div>
      </div>

      {/* Score */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</div>
          {hasEditedScore && (
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'}`}>
              {status === 'complete' ? 'COMPLETE' : 'INCOMPLETE'}
            </div>
          )}
        </div>

        {/* Team avatar labels */}
        {allSelected && (
          <div className="flex items-center gap-3 mb-2 px-10">
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
            <div className="w-5" />
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

        {/* Set rows */}
        <div className="space-y-2">
          {sets.map((set, i) => {
            const dimmed = i === 2 && !thirdSetActive
            const lastActiveRef = thirdSetActive ? 5 : 3
            const refA = i * 2
            const refB = i * 2 + 1
            return (
              <div
                key={i}
                className={`flex items-center gap-2 transition-opacity ${dimmed ? 'opacity-25 pointer-events-none' : ''}`}
              >
                <span className="text-xs text-muted-foreground w-10 shrink-0">Set {i + 1}</span>
                <input
                  ref={el => { inputRefs.current[refA] = el }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  min={0}
                  max={7}
                  value={set.teamAGames}
                  onChange={e => updateScore(i, 'A', Number(e.target.value))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(refA) } }}
                  className="flex-1 min-w-0 w-0 bg-white/5 border border-white/10 rounded-xl px-2 py-3 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-green/60"
                />
                <span className="text-muted-foreground text-sm font-bold shrink-0">—</span>
                <input
                  ref={el => { inputRefs.current[refB] = el }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint={refB >= lastActiveRef ? 'done' : 'next'}
                  min={0}
                  max={7}
                  value={set.teamBGames}
                  onChange={e => updateScore(i, 'B', Number(e.target.value))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(refB) } }}
                  className="flex-1 min-w-0 w-0 bg-white/5 border border-white/10 rounded-xl px-2 py-3 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-green/60"
                />
              </div>
            )
          })}
        </div>

        {/* Winner announcement */}
        {allSelected && hasEditedScore && winner && (
          <div className="mt-3 text-center text-sm font-bold text-neon-green">
            {getPlayer(winner === 'A' ? teamA1 : teamB1)?.name.split(' ')[0]} &amp; {getPlayer(winner === 'A' ? teamA2 : teamB2)?.name.split(' ')[0]} win
          </div>
        )}
      </div>

      {/* Ranked / unranked */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match Type</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsRanked(true)}
            className={`py-2 rounded-xl text-sm font-bold transition-all ${
              isRanked ? 'bg-neon-green text-background' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Ranked
          </button>
          <button
            onClick={() => setIsRanked(false)}
            className={`py-2 rounded-xl text-sm font-bold transition-all ${
              !isRanked ? 'bg-neon-green text-background' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Unranked
          </button>
        </div>
        {!isRanked && (
          <div className="text-[10px] text-muted-foreground text-center">
            Stats, streaks, and history are still recorded — PTR won&apos;t change
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={submitting || !allSelected}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {submitting ? 'Saving...' : 'Save Match'}
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
