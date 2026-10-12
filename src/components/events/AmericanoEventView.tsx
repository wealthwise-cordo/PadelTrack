'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Coffee } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import TeamPill, { type Players } from '@/components/events/TeamPill'
import { computeExcludedRounds, computeLeaderboardPoints } from '@/lib/americano'
import type { PlayerWithStats } from '@/types'
import type { AmericanoEventView as EventData, AmericanoMatchView as Match } from '@/lib/americano-store'

interface Props {
  event: EventData
  players: PlayerWithStats[]
}

// The current round (one match per court, each scored separately), who's
// sitting out, what's next, and every match. On one court a round is a match.
export default function AmericanoEventView({ event, players }: Props) {
  const byId: Players = new Map(players.map(p => [p.id, p]))
  const player = (id: string) => byId.get(id)
  const firstName = (id: string) => player(id)?.name.split(' ')[0] ?? '—'

  const completed = event.matches.filter(m => m.status === 'complete')
  const pending = event.matches.filter(m => m.status === 'pending')
  const rounds = Math.max(0, ...event.matches.map(m => m.round))
  const multiCourt = event.courts > 1
  const roundMatches = (r: number) => event.matches.filter(m => m.round === r).sort((a, b) => (a.court ?? 1) - (b.court ?? 1))
  const currentRound = pending.length ? Math.min(...pending.map(m => m.round)) : null
  const nextRound = currentRound !== null ? (pending.filter(m => m.round > currentRound).map(m => m.round).sort((a, b) => a - b)[0] ?? null) : null
  const sittingOut = (r: number) => {
    const playing = new Set(roundMatches(r).flatMap(m => [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]))
    return event.playerIds.filter(id => !playing.has(id))
  }

  const excludedRounds = computeExcludedRounds(event.matches, event.playerIds)
  const excludedNote = (m: Match) => {
    const names = [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id]
      .filter(id => excludedRounds.get(id) === m.round)
      .map(firstName)
    return names.length > 0 ? `Doesn't count toward ${names.join(' & ')}'s total` : null
  }
  const points = computeLeaderboardPoints(event.matches, event.playerIds)
  const leaderboard = event.playerIds
    .map(id => ({ id, pts: points.get(id) ?? 0 }))
    .sort((a, b) => b.pts - a.pts)

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black tracking-tight">Americano</h1>
          <div className="text-[11px] text-muted-foreground">
            {event.playerIds.length} players · {event.target} {event.scoreMode} a match · {event.courts} court{event.courts > 1 ? 's' : ''}
          </div>
        </div>
        {event.status === 'complete' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green font-bold uppercase tracking-wide">
            Complete
          </span>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-neon-green" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leaderboard</span>
        </div>
        <div className="space-y-1.5">
          {leaderboard.map((row, i) => {
            const p = player(row.id)
            if (!p) return null
            return (
              <div key={row.id} className="flex items-center gap-2.5">
                <span className="w-5 text-[11px] font-mono text-muted-foreground text-right shrink-0">{i + 1}</span>
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {getInitials(p.name)}
                </div>
                <span className="flex-1 text-xs font-medium truncate">{p.name.split(' ')[0]}</span>
                <span className="text-sm font-mono font-bold tabular-nums">{row.pts}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current round */}
      {currentRound !== null && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-neon-green/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{multiCourt ? `Round ${currentRound}` : 'Current Match'}</span>
            <span className="text-[10px] font-mono text-muted-foreground">Round {currentRound}/{rounds}</span>
          </div>
          <div className="space-y-3 divide-y divide-zinc-900/5">
            {roundMatches(currentRound).map(m => (
              <div key={m.id} className="pt-3 first:pt-0 space-y-2">
                {multiCourt && <div className="text-[10px] font-bold text-neon-green uppercase tracking-wider">Court {m.court ?? 1}</div>}
                {m.status === 'complete' ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex-1 min-w-0 truncate font-semibold">{firstName(m.teamAPlayer1Id)} &amp; {firstName(m.teamAPlayer2Id)}</span>
                    <span className="font-mono font-bold">{m.teamAScore}–{m.teamBScore}</span>
                    <span className="flex-1 min-w-0 truncate text-right font-semibold">{firstName(m.teamBPlayer1Id)} &amp; {firstName(m.teamBPlayer2Id)}</span>
                  </div>
                ) : (
                  <ScoreEntry eventId={event.id} match={m} target={event.target} byId={byId} note={excludedNote(m)} />
                )}
              </div>
            ))}
          </div>
          {sittingOut(currentRound).length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-zinc-900/5 pt-2">
              <Coffee className="h-3.5 w-3.5 shrink-0" />
              Sitting out: {sittingOut(currentRound).map(firstName).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Up next */}
      {nextRound !== null && (
        <div className="glass rounded-xl p-3 opacity-70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Up Next</span>
            <span className="text-[10px] font-mono text-muted-foreground">Round {nextRound}/{rounds}</span>
          </div>
          {roundMatches(nextRound).map(m => (
            <div key={m.id} className="flex items-center justify-between gap-2">
              {multiCourt && <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0">C{m.court ?? 1}</span>}
              <TeamPill p1={m.teamAPlayer1Id} p2={m.teamAPlayer2Id} byId={byId} />
              <span className="text-[10px] font-black text-zinc-900/25 shrink-0">VS</span>
              <TeamPill p1={m.teamBPlayer1Id} p2={m.teamBPlayer2Id} byId={byId} />
            </div>
          ))}
        </div>
      )}

      {event.status === 'complete' && (
        <div className="text-center text-sm font-bold text-neon-green py-2">
          🏆 Event complete
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
        <div className="divide-y divide-zinc-900/5">
          {[...event.matches]
            .sort((a, b) => a.round - b.round || (a.court ?? 1) - (b.court ?? 1))
            .map(m => (
              <div key={m.id} className="py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-9 shrink-0 font-mono text-muted-foreground">{multiCourt ? `R${m.round}·${m.court ?? 1}` : m.round}</span>
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
                {excludedNote(m) && (
                  <div className="text-[9px] text-amber-600/70 text-center mt-1">{excludedNote(m)}</div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// Score boxes for one match. Americano scores add up to the target, so typing
// one side fills in the other.
function ScoreEntry({ eventId, match, target, byId, note }: { eventId: string; match: Match; target: number; byId: Players; note: string | null }) {
  const router = useRouter()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fill = (val: string, set: (v: string) => void, setOther: (v: string) => void) => {
    set(val)
    const n = Number(val)
    setOther(val !== '' && Number.isFinite(n) && n >= 0 && n <= target ? String(target - n) : '')
  }

  const save = async () => {
    const sa = Number(a)
    const sb = Number(b)
    if (a === '' || b === '' || !Number.isFinite(sa) || !Number.isFinite(sb) || sa === sb) {
      setError('Enter two different scores')
      return
    }
    if (sa + sb !== target) {
      setError(`Scores must add up to ${target}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/americano/${eventId}/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAScore: sa, teamBScore: sb }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to save')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const input = (value: string, onChange: (v: string) => void, label: string) => (
    <input autoComplete="off"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.select()}
      placeholder="0"
      className="w-14 shrink-0 bg-zinc-900/5 border border-zinc-900/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-green/60"
    />
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
        {input(a, v => fill(v, setA, setB), 'First team score')}
      </div>
      <div className="flex items-center justify-between gap-3">
        <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
        {input(b, v => fill(v, setB, setA), 'Second team score')}
      </div>
      <div className="text-[10px] text-muted-foreground text-center">Scores must add up to {target}</div>
      {note && <div className="text-[10px] text-amber-600/80 text-center">{note}</div>}
      {error && <div className="text-xs text-red-600 text-center">{error}</div>}
      <button
        onClick={save}
        disabled={submitting}
        className="w-full py-2.5 rounded-xl font-bold text-sm bg-neon-green text-white hover:bg-neon-green/90 disabled:opacity-40 transition-all"
      >
        {submitting ? 'Saving…' : 'Save score'}
      </button>
    </div>
  )
}
