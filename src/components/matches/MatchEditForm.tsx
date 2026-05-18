'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getInitials, formatPTR, setWinner } from '@/lib/utils'
import type { MatchWithPlayers } from '@/types'

interface SetScore {
  teamAGames: number
  teamBGames: number
}

function matchStatus(sets: SetScore[]): { status: 'complete' | 'incomplete'; winner: 'A' | 'B' | null } {
  const setsA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const setsB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  if (setsA >= 2) return { status: 'complete', winner: 'A' }
  if (setsB >= 2) return { status: 'complete', winner: 'B' }
  return { status: 'incomplete', winner: null }
}

export default function MatchEditForm({ match }: { match: MatchWithPlayers }) {
  const router = useRouter()
  const [sets, setSets] = useState<SetScore[]>(() => {
    const existing = match.sets.map(s => ({ teamAGames: s.teamAGames, teamBGames: s.teamBGames }))
    while (existing.length < 3) existing.push({ teamAGames: 0, teamBGames: 0 })
    return existing
  })
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { status, winner } = matchStatus(sets)

  const completedA = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
  const completedB = sets.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
  const thirdSetActive = (completedA === 1 && completedB === 1) || sets[2].teamAGames + sets[2].teamBGames > 0

  const teamA = [match.teamAPlayer1, match.teamAPlayer2]
  const teamB = [match.teamBPlayer1, match.teamBPlayer2]

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets, winner, status }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Update failed')
      } else {
        router.push('/matches')
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Players summary */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              {teamA.map(p => (
                <div key={p.id} className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                  {getInitials(p.name)}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{teamA.map(p => p.name.split(' ')[0]).join(' & ')}</div>
          </div>
          <span className="text-[11px] font-black text-white/30 tracking-[0.2em]">VS</span>
          <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              {teamB.map(p => (
                <div key={p.id} className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                  {getInitials(p.name)}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{teamB.map(p => p.name.split(' ')[0]).join(' & ')}</div>
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</div>
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'}`}>
            {status === 'complete' ? 'COMPLETE' : 'INCOMPLETE'}
          </div>
        </div>

        {/* Team avatar labels */}
        <div className="flex items-center gap-3 mb-2 px-12">
          <div className="flex-1 flex items-center gap-1.5">
            {teamA.map(p => (
              <div key={p.id} className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                {getInitials(p.name)}
              </div>
            ))}
          </div>
          <div className="w-4" />
          <div className="flex-1 flex items-center justify-end gap-1.5">
            {teamB.map(p => (
              <div key={p.id} className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background" style={{ backgroundColor: p.avatarColor }}>
                {getInitials(p.name)}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {sets.map((set, i) => {
            const dimmed = i === 2 && !thirdSetActive
            const lastActiveRef = thirdSetActive ? 5 : 3
            const refA = i * 2
            const refB = i * 2 + 1
            return (
              <div key={i} className={`flex items-center gap-3 transition-opacity ${dimmed ? 'opacity-30 pointer-events-none' : ''}`}>
                <span className="text-xs text-muted-foreground w-12 shrink-0">Set {i + 1}</span>
                <input
                  ref={el => { inputRefs.current[refA] = el }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  min={0} max={7} value={set.teamAGames}
                  onChange={e => { const v = [...sets]; v[i] = { ...v[i], teamAGames: Number(e.target.value) }; setSets(v) }}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); inputRefs.current[refA + 1]?.focus() } }}
                  className="flex-1 min-w-0 w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-green/50"
                />
                <span className="text-muted-foreground text-xs font-bold">—</span>
                <input
                  ref={el => { inputRefs.current[refB] = el }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint={refB >= lastActiveRef ? 'done' : 'next'}
                  min={0} max={7} value={set.teamBGames}
                  onChange={e => { const v = [...sets]; v[i] = { ...v[i], teamBGames: Number(e.target.value) }; setSets(v) }}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (refB < lastActiveRef) inputRefs.current[refB + 1]?.focus(); else (e.target as HTMLInputElement).blur() } }}
                  className="flex-1 min-w-0 w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-green/50"
                />
              </div>
            )
          })}
        </div>

        {winner && (
          <div className="mt-3 text-center text-sm font-bold text-neon-green">
            {(winner === 'A' ? teamA : teamB).map(p => p.name.split(' ')[0]).join(' & ')} win
          </div>
        )}

        {status === 'incomplete' && (
          <p className="mt-3 text-[11px] text-yellow-400/70 text-center">
            Still incomplete — won&apos;t affect rankings until a winner is determined.
          </p>
        )}
      </div>

      {error && <div className="text-sm text-red-400 text-center">{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {submitting ? 'Saving...' : status === 'complete' ? 'Finalise Match' : 'Save & Keep Incomplete'}
      </button>
    </div>
  )
}
