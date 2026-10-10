'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, X, CheckCircle2, Clock } from 'lucide-react'
import { getInitials, formatPTR, setWinner, formatDelta } from '@/lib/utils'
import PlayerPicker from '@/components/shared/PlayerPicker'
import type { PlayerWithStats } from '@/types'

interface SetScore {
  teamAGames: number
  teamBGames: number
}

interface Props {
  me: PlayerWithStats
  players: PlayerWithStats[]
}

type Slots = [string, string, string, string]

const EMPTY_SETS: SetScore[] = [
  { teamAGames: 0, teamBGames: 0 },
  { teamAGames: 0, teamBGames: 0 },
  { teamAGames: 0, teamBGames: 0 },
]

const SLOT_LABELS = ['You', 'Your partner', 'Opponent', 'Opponent']

function matchWinner(sets: SetScore[]): 'A' | 'B' | null {
  const setsA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const setsB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  if (setsA >= 2) return 'A'
  if (setsB >= 2) return 'B'
  return null
}

export default function MatchEntryForm({ me, players: initialPlayers }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useState(initialPlayers)
  const [slots, setSlots] = useState<Slots>([me.id, '', '', ''])
  const [pickingSlot, setPickingSlot] = useState<number | null>(null)
  const [sets, setSets] = useState<SetScore[]>(EMPTY_SETS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ status: 'pending' | 'complete'; ptrDelta: number } | null>(null)

  // 6 input refs: [s0A, s0B, s1A, s1B, s2A, s2B]
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null])

  const allSelected = slots.every(Boolean)
  const getPlayer = (id: string) => players.find(p => p.id === id)
  const winner = matchWinner(sets)

  const selectPlayer = (p: PlayerWithStats) => {
    if (pickingSlot === null) return
    const next = [...slots] as Slots
    next[pickingSlot] = p.id
    setSlots(next)
    setPickingSlot(null)
  }

  const clearSlot = (slotIdx: number) => {
    const next = [...slots] as Slots
    next[slotIdx] = ''
    setSlots(next)
  }

  const updateScore = (setIdx: number, team: 'A' | 'B', raw: string) => {
    const val = Math.max(0, Math.min(7, Number(raw.replace(/\D/g, '')) || 0))
    const v = [...sets]
    v[setIdx] = team === 'A' ? { ...v[setIdx], teamAGames: val } : { ...v[setIdx], teamBGames: val }
    setSets(v)
  }

  const focusNext = (refIdx: number) => {
    if (refIdx >= 5) inputRefs.current[refIdx]?.blur()
    else inputRefs.current[refIdx + 1]?.focus()
  }

  const handleSubmit = async () => {
    if (!allSelected) { setError('Pick all four players first'); return }
    if (!winner) { setError('Enter a finished best-of-three score'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAPlayer1Id: slots[0], teamAPlayer2Id: slots[1],
          teamBPlayer1Id: slots[2], teamBPlayer2Id: slots[3],
          sets: sets.filter(s => s.teamAGames + s.teamBGames > 0),
          winner,
        }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Could not save the match')
      else {
        setSaved({ status: d.status, ptrDelta: d.ptrDelta })
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    const opponents = [getPlayer(slots[2]), getPlayer(slots[3])].filter(p => p && !p.isGuest).map(p => p!.name.split(' ')[0])
    return (
      <div className="py-16 flex flex-col items-center text-center gap-3">
        {saved.status === 'complete' ? (
          <>
            <CheckCircle2 className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Match recorded</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              Ratings updated — {winner === 'A' ? 'your team gained' : 'your team lost'}{' '}
              <span className="font-mono font-bold text-zinc-900">{formatDelta(saved.ptrDelta).replace(/^[+-]/, '')}</span> points.
            </p>
          </>
        ) : (
          <>
            <Clock className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Waiting for confirmation</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              {opponents.join(' or ')} needs to confirm the result before ratings change. If nobody responds within 48 hours, it confirms automatically.
            </p>
          </>
        )}
        <div className="flex gap-2 mt-4">
          <Link href="/matches" className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800">Go to Match Centre</Link>
          <button
            onClick={() => { setSaved(null); setSlots([me.id, '', '', '']); setSets(EMPTY_SETS) }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-zinc-300 hover:bg-zinc-50"
          >
            Record another
          </button>
        </div>
      </div>
    )
  }

  const Slot = ({ idx }: { idx: number }) => {
    const player = getPlayer(slots[idx])
    const locked = idx === 0
    if (player) {
      return (
        <div className="relative flex items-center gap-2.5 h-16 px-3 rounded-xl border border-zinc-200 bg-white w-full">
          <button disabled={locked} onClick={() => setPickingSlot(idx)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
            <span className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: player.avatarColor }}>
              {getInitials(player.name)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{locked ? 'You' : player.name.split(' ')[0]}</span>
              <span className="block text-[11px] text-zinc-500 font-mono">{player.isGuest ? 'Guest · ' : ''}{formatPTR(player.ptr)}</span>
            </span>
          </button>
          {!locked && (
            <button onClick={() => clearSlot(idx)} className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0" aria-label="Remove">
              <X className="h-3 w-3 text-zinc-500" />
            </button>
          )}
        </div>
      )
    }
    return (
      <button
        onClick={() => setPickingSlot(idx)}
        className="flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition w-full text-sm font-medium"
      >
        <Plus className="h-4 w-4" /> {SLOT_LABELS[idx]}
      </button>
    )
  }

  return (
    <div className="pt-6 space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight">New match</h1>
        <p className="text-sm text-zinc-500">Ranked — counts towards everyone&apos;s rating once confirmed.</p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Your team</div>
        <div className="grid grid-cols-2 gap-2">
          <Slot idx={0} />
          <Slot idx={1} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-[11px] font-black text-zinc-400 tracking-[0.2em]">VS</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Opponents</div>
        <div className="grid grid-cols-2 gap-2">
          <Slot idx={2} />
          <Slot idx={3} />
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-12 shrink-0 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Score</div>
          <div className="flex-1 text-center text-[11px] font-semibold text-zinc-500">Us</div>
          <div className="flex-1 text-center text-[11px] font-semibold text-zinc-500">Them</div>
        </div>
        <div className="space-y-2">
          {sets.map((set, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-12 shrink-0">Set {i + 1}</span>
              {(['A', 'B'] as const).map((team, j) => {
                const refIdx = i * 2 + j
                return (
                  <input
                    key={team}
                    ref={el => { inputRefs.current[refIdx] = el }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint={refIdx >= 5 ? 'done' : 'next'}
                    value={team === 'A' ? set.teamAGames : set.teamBGames}
                    onChange={e => updateScore(i, team, e.target.value)}
                    onFocus={e => e.target.select()}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(refIdx) } }}
                    className="flex-1 min-w-0 w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-2 py-3 font-mono text-center text-lg font-bold focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    aria-label={`Set ${i + 1} ${team === 'A' ? 'your' : 'their'} games`}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {winner && (
          <div className={`mt-3 text-center text-sm font-bold ${winner === 'A' ? 'text-orange-600' : 'text-zinc-600'}`}>
            {winner === 'A' ? 'You win' : 'Opponents win'} {sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === winner).length}–{sets.filter(s => { const w = setWinner(s.teamAGames, s.teamBGames); return w && w !== winner }).length}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 text-center">{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={submitting || !allSelected || !winner}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {submitting ? 'Saving…' : 'Save match'}
      </button>

      <PlayerPicker
        open={pickingSlot !== null}
        title={pickingSlot !== null ? SLOT_LABELS[pickingSlot] : undefined}
        players={players}
        excludeIds={slots.filter(Boolean)}
        onClose={() => setPickingSlot(null)}
        onSelect={selectPlayer}
        onDiscovered={p => setPlayers(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])}
      />
    </div>
  )
}
