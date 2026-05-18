'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, RotateCcw, Lock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getInitials, getFullScore } from '@/lib/utils'
import type { MatchWithPlayers } from '@/types'

const PASSCODE = '5299'

export default function AdminPanel({ matches }: { matches: MatchWithPlayers[] }) {
  const router = useRouter()
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [resetText, setResetText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const handleUnlock = () => {
    if (code === PASSCODE) {
      setUnlocked(true)
      setCodeError(false)
    } else {
      setCodeError(true)
      setCode('')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError('')
    try {
      const res = await fetch(`/api/admin/matches/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setDeleteError('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleReset = async () => {
    if (resetText !== 'reset') return
    setResetting(true)
    try {
      await fetch('/api/admin/reset', { method: 'POST' })
      setResetDone(true)
      setResetText('')
      router.refresh()
    } catch {
      // ignore
    } finally {
      setResetting(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-5 w-5" />
          <span className="text-sm font-medium">Admin Access</span>
        </div>
        <div className="glass rounded-2xl p-6 w-full max-w-xs space-y-4">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter passcode"
            value={code}
            onChange={e => { setCode(e.target.value); setCodeError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-center font-mono text-xl tracking-widest focus:outline-none transition-colors ${
              codeError ? 'border-red-400/50 text-red-400' : 'border-white/10 focus:border-neon-green/50'
            }`}
          />
          {codeError && <p className="text-xs text-red-400 text-center">Incorrect passcode</p>}
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 transition-all"
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>

      {/* Match list */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match History</h2>

        {deleteError && <p className="text-sm text-red-400 text-center">{deleteError}</p>}

        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matches recorded.</p>
        )}

        {matches.map(match => {
          const teamA = [match.teamAPlayer1, match.teamAPlayer2]
          const teamB = [match.teamBPlayer1, match.teamBPlayer2]
          const incomplete = match.status === 'incomplete'

          return (
            <div key={match.id} className="glass rounded-xl p-3 flex items-center gap-3">
              {/* Teams + score */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    {teamA.map(p => (
                      <div
                        key={p.id}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {getInitials(p.name)}
                      </div>
                    ))}
                  </div>
                  <span className="font-mono text-xs font-bold">{getFullScore(match.sets)}</span>
                  <div className="flex items-center gap-1">
                    {teamB.map(p => (
                      <div
                        key={p.id}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {getInitials(p.name)}
                      </div>
                    ))}
                  </div>
                  {incomplete && (
                    <span className="text-[9px] bg-yellow-400/15 text-yellow-400 rounded px-1 py-0.5 font-medium">INC</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(match.id)}
                disabled={deletingId === match.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete match"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Reset section */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Danger Zone</h2>
        <div className="glass rounded-xl p-4 border border-red-400/20 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-red-400">Reset Database</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Wipes all matches and resets every player back to 1000 PTR. This cannot be undone.
              </div>
            </div>
          </div>

          {resetDone && (
            <p className="text-xs text-neon-green text-center font-semibold">Database reset successfully.</p>
          )}

          <input
            type="text"
            placeholder='Type "reset" to confirm'
            value={resetText}
            onChange={e => { setResetText(e.target.value); setResetDone(false) }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400/50 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleReset}
            disabled={resetText !== 'reset' || resetting}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <RotateCcw className="h-4 w-4 inline mr-2" />
            {resetting ? 'Resetting...' : 'Reset Everything'}
          </button>
        </div>
      </div>
    </div>
  )
}
