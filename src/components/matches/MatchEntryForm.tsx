'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PTRPreview from './PTRPreview'
import { getInitials, formatPTR } from '@/lib/utils'
import type { PlayerWithStats, PTRCalculation } from '@/types'

interface SetScore {
  teamAGames: number
  teamBGames: number
}

interface Props {
  players: PlayerWithStats[]
}

export default function MatchEntryForm({ players }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [teamA1, setTeamA1] = useState('')
  const [teamA2, setTeamA2] = useState('')
  const [teamB1, setTeamB1] = useState('')
  const [teamB2, setTeamB2] = useState('')
  const [sets, setSets] = useState<SetScore[]>([{ teamAGames: 0, teamBGames: 0 }])
  const [preview, setPreview] = useState<PTRCalculation | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const selected = [teamA1, teamA2, teamB1, teamB2].filter(Boolean)
  const available = (exclude: string[]) => players.filter(p => !exclude.includes(p.id))

  const getPlayer = (id: string) => players.find(p => p.id === id)

  const determineWinner = (): 'A' | 'B' | null => {
    if (sets.length === 0) return null
    const setsA = sets.filter(s => s.teamAGames > s.teamBGames).length
    const setsB = sets.filter(s => s.teamBGames > s.teamAGames).length
    if (setsA > setsB) return 'A'
    if (setsB > setsA) return 'B'
    return null
  }

  const fetchPreview = useCallback(async () => {
    if (!teamA1 || !teamA2 || !teamB1 || !teamB2) return
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAPlayer1Id: teamA1, teamAPlayer2Id: teamA2, teamBPlayer1Id: teamB1, teamBPlayer2Id: teamB2, sets }),
      })
      const data = await res.json()
      setPreview(data)
    } catch {
      // silently fail preview
    } finally {
      setPreviewLoading(false)
    }
  }, [teamA1, teamA2, teamB1, teamB2, sets])

  useEffect(() => {
    if (teamA1 && teamA2 && teamB1 && teamB2) {
      fetchPreview()
    }
  }, [teamA1, teamA2, teamB1, teamB2, fetchPreview])

  const handleSubmit = async () => {
    const winner = determineWinner()
    if (!winner) { setError('Match result is unclear — check your scores'); return }
    if (!teamA1 || !teamA2 || !teamB1 || !teamB2) { setError('Select all 4 players'); return }

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

  const PlayerSelector = ({ value, onChange, exclude, label }: {
    value: string; onChange: (v: string) => void; exclude: string[]; label: string
  }) => (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {players.map(p => {
          const disabled = exclude.includes(p.id) && p.id !== value
          return (
            <button
              key={p.id}
              onClick={() => !disabled && onChange(p.id)}
              disabled={disabled}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-sm ${
                value === p.id
                  ? 'border-neon-green/50 bg-neon-green/10 text-neon-green'
                  : disabled
                  ? 'border-white/5 opacity-30 cursor-not-allowed'
                  : 'border-white/10 hover:border-white/30 hover:bg-white/5'
              }`}
            >
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                style={{ backgroundColor: p.avatarColor }}
              >
                {getInitials(p.name)}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name.split(' ')[0]}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{formatPTR(p.ptr)}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-6xl">🏆</div>
        <div className="text-xl font-bold text-neon-green">Match Recorded!</div>
        <div className="text-sm text-muted-foreground">Redirecting to rankings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Team A */}
      <div className="glass rounded-xl p-4 border-l-2 border-neon-green">
        <div className="text-xs font-semibold text-neon-green mb-3 uppercase tracking-wider">Team A</div>
        <PlayerSelector
          value={teamA1}
          onChange={setTeamA1}
          exclude={[teamA2, teamB1, teamB2]}
          label="Player 1"
        />
        <div className="mt-3">
          <PlayerSelector
            value={teamA2}
            onChange={setTeamA2}
            exclude={[teamA1, teamB1, teamB2]}
            label="Player 2"
          />
        </div>
      </div>

      {/* Team B */}
      <div className="glass rounded-xl p-4 border-l-2 border-neon-blue">
        <div className="text-xs font-semibold text-neon-blue mb-3 uppercase tracking-wider">Team B</div>
        <PlayerSelector
          value={teamB1}
          onChange={setTeamB1}
          exclude={[teamA1, teamA2, teamB2]}
          label="Player 1"
        />
        <div className="mt-3">
          <PlayerSelector
            value={teamB2}
            onChange={setTeamB2}
            exclude={[teamA1, teamA2, teamB1]}
            label="Player 2"
          />
        </div>
      </div>

      {/* Score Entry */}
      <div className="glass rounded-xl p-4">
        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Score</div>
        <div className="space-y-3">
          {sets.map((set, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Set {i + 1}</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex flex-col gap-0.5 flex-1">
                  <label className="text-[10px] text-neon-green">A</label>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={set.teamAGames}
                    onChange={e => {
                      const v = [...sets]
                      v[i] = { ...v[i], teamAGames: Number(e.target.value) }
                      setSets(v)
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
                <span className="text-muted-foreground mt-4">—</span>
                <div className="flex flex-col gap-0.5 flex-1">
                  <label className="text-[10px] text-neon-blue">B</label>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={set.teamBGames}
                    onChange={e => {
                      const v = [...sets]
                      v[i] = { ...v[i], teamBGames: Number(e.target.value) }
                      setSets(v)
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-center text-sm focus:outline-none focus:border-neon-blue/50"
                  />
                </div>
                {i > 0 && (
                  <button
                    onClick={() => setSets(sets.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-red-400 text-sm mt-4"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {sets.length < 3 && (
          <button
            onClick={() => setSets([...sets, { teamAGames: 0, teamBGames: 0 }])}
            className="mt-3 text-xs text-muted-foreground hover:text-neon-green transition-colors"
          >
            + Add set
          </button>
        )}
        {determineWinner() && (
          <div className="mt-3 text-center text-sm font-semibold text-neon-green">
            Team {determineWinner()} wins
          </div>
        )}
      </div>

      {/* PTR Preview */}
      <PTRPreview preview={preview} loading={previewLoading} />

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 text-center">{error}</div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !teamA1 || !teamA2 || !teamB1 || !teamB2 || !determineWinner()}
        className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {submitting ? 'Recording Match...' : 'Record Match'}
      </button>
    </div>
  )
}
