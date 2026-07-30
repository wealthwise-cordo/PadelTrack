'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { computeLeaderboardPoints } from '@/lib/americano'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventView as EventData } from '@/lib/round-robin-store'

interface Props {
  event: EventData
  players: PlayerWithStats[]
}

export default function RoundRobinEventView({ event, players }: Props) {
  const router = useRouter()
  const [teamAScore, setTeamAScore] = useState('')
  const [teamBScore, setTeamBScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const byId = new Map(players.map(p => [p.id, p]))
  const player = (id: string) => byId.get(id)
  const firstName = (id: string) => player(id)?.name.split(' ')[0] ?? '—'

  const completed = event.matches.filter(m => m.status === 'complete')
  const pending = [...event.matches].filter(m => m.status === 'pending').sort((a, b) => a.round - b.round)
  const current = pending[0]
  const next = pending[1]

  const allPlayerIds = event.teams.flat()
  const points = computeLeaderboardPoints(event.matches, allPlayerIds)
  const leaderboard = event.teams
    .map((team, teamIndex) => ({ teamIndex, team, pts: points.get(team[0]) ?? 0 }))
    .sort((a, b) => b.pts - a.pts)

  const target = event.target

  const submitScore = async () => {
    if (!current) return
    const a = Number(teamAScore)
    const b = Number(teamBScore)
    if (!Number.isFinite(a) || !Number.isFinite(b) || teamAScore === '' || teamBScore === '' || a === b) {
      setError('Enter two different scores')
      return
    }
    const hi = Math.max(a, b)
    const lo = Math.min(a, b)
    if (hi !== target || lo >= target) {
      setError(`First to ${target} — winner's score must be ${target}, the other lower`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/round-robin/${event.id}/matches/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAScore: a, teamBScore: b }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save')
      } else {
        setTeamAScore('')
        setTeamBScore('')
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const TeamPill = ({ p1, p2 }: { p1: string; p2: string }) => (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-1.5 shrink-0">
        {[p1, p2].map(id => {
          const p = player(id)
          if (!p) return null
          return (
            <div
              key={id}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-background ring-2 ring-[hsl(222,47%,8%)]"
              style={{ backgroundColor: p.avatarColor }}
            >
              {getInitials(p.name)}
            </div>
          )
        })}
      </div>
      <span className="text-xs font-semibold truncate">{firstName(p1)} &amp; {firstName(p2)}</span>
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
        <h1 className="text-2xl font-black tracking-tight flex-1">Round Robin</h1>
        {!event.isRanked && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground font-bold uppercase tracking-wide">
            Unranked
          </span>
        )}
        {event.status === 'complete' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-blue/15 text-neon-blue font-bold uppercase tracking-wide">
            Complete
          </span>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-neon-blue" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leaderboard</span>
        </div>
        <div className="space-y-1.5">
          {leaderboard.map((row, i) => {
            const p1 = player(row.team[0])
            const p2 = player(row.team[1])
            if (!p1 || !p2) return null
            const delta = event.ptrDeltas?.[row.team[0]]
            return (
              <div key={row.teamIndex} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-mono text-muted-foreground text-right shrink-0">{i + 1}</span>
                <div className="flex -space-x-1.5 shrink-0">
                  {[p1, p2].map(p => (
                    <div
                      key={p.id}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background ring-2 ring-[hsl(222,47%,8%)]"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {getInitials(p.name)}
                    </div>
                  ))}
                </div>
                <span className="flex-1 text-xs font-medium truncate">
                  {p1.name.split(' ')[0]} &amp; {p2.name.split(' ')[0]}
                </span>
                <span className="text-sm font-mono font-bold tabular-nums">{row.pts}</span>
                {delta !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold tabular-nums w-11 text-right shrink-0 ${
                      delta >= 0 ? 'text-neon-green' : 'text-red-400'
                    }`}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta} PTR
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Current match */}
      {current && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-neon-blue/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Match</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Match {current.round}/{event.matches.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <TeamPill p1={current.teamAPlayer1Id} p2={current.teamAPlayer2Id} />
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamAScore}
              onChange={e => setTeamAScore(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="w-14 shrink-0 bg-white/5 border border-white/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-blue/60"
            />
          </div>
          <div className="flex items-center gap-3">
            <TeamPill p1={current.teamBPlayer1Id} p2={current.teamBPlayer2Id} />
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamBScore}
              onChange={e => setTeamBScore(e.target.value)}
              onFocus={e => e.target.select()}
              placeholder="0"
              className="w-14 shrink-0 bg-white/5 border border-white/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-blue/60"
            />
          </div>
          <div className="text-[10px] text-muted-foreground text-center">
            First to {target} — winner&apos;s score is {target}, the other lower
          </div>

          {error && <div className="text-xs text-red-400 text-center">{error}</div>}

          <button
            onClick={submitScore}
            disabled={submitting}
            className="w-full py-3 rounded-xl font-bold text-sm bg-neon-blue text-background hover:bg-neon-blue/90 disabled:opacity-40 transition-all"
          >
            {submitting ? 'Saving...' : 'Save Score'}
          </button>
        </div>
      )}

      {/* Next match */}
      {next && (
        <div className="glass rounded-xl p-3 opacity-70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Up Next</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Match {next.round}/{event.matches.length}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <TeamPill p1={next.teamAPlayer1Id} p2={next.teamAPlayer2Id} />
            <span className="text-[10px] font-black text-white/25 shrink-0">VS</span>
            <TeamPill p1={next.teamBPlayer1Id} p2={next.teamBPlayer2Id} />
          </div>
        </div>
      )}

      {event.status === 'complete' && (
        <div className="text-center text-sm font-bold text-neon-blue py-2">
          {event.isRanked ? '🏆 Event complete — PTR updated for all teams' : '🏆 Event complete — unranked, PTR unaffected'}
        </div>
      )}

      {/* All matches */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Matches</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {completed.length}/{event.matches.length}
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {[...event.matches]
            .sort((a, b) => a.round - b.round)
            .map(m => (
              <div key={m.id} className="py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-5 shrink-0 font-mono text-muted-foreground">{m.round}</span>
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">
                    {firstName(m.teamAPlayer1Id)} &amp; {firstName(m.teamAPlayer2Id)}
                  </span>
                  <span
                    className={`w-16 shrink-0 text-center font-mono font-bold ${
                      m.status === 'complete' ? 'text-foreground' : 'text-muted-foreground/40'
                    }`}
                  >
                    {m.status === 'complete' ? `${m.teamAScore}–${m.teamBScore}` : '— vs —'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-right text-muted-foreground">
                    {firstName(m.teamBPlayer1Id)} &amp; {firstName(m.teamBPlayer2Id)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
