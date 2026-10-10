'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, ArrowDown, Flag, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { finalPlacements } from '@/lib/snake-ladders'
import type { PlayerWithStats } from '@/types'
import type { SnakeLaddersEventView as EventData, SnakeLaddersMatchView } from '@/lib/snake-ladders-store'

interface Props {
  event: EventData
  players: PlayerWithStats[]
}

const PLACEMENT_LABELS = ['1st', '2nd', '3rd', '4th']

type PlayerLookup = Map<string, PlayerWithStats>

function TeamPill({ p1, p2, byId }: { p1: string; p2: string; byId: PlayerLookup }) {
  const firstName = (id: string) => byId.get(id)?.name.split(' ')[0] ?? '—'
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex -space-x-1.5 shrink-0">
        {[p1, p2].map(id => {
          const p = byId.get(id)
          if (!p) return null
          return (
            <div
              key={id}
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
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
}

export default function SnakeLaddersEventView({ event, players }: Props) {
  const byId: PlayerLookup = new Map(players.map(p => [p.id, p]))
  const firstName = (id: string) => byId.get(id)?.name.split(' ')[0] ?? '—'

  const currentRoundNum = event.matches.reduce((max, m) => Math.max(max, m.round), 1)
  const currentRoundMatches = event.matches.filter(m => m.round === currentRoundNum)
  const topMatch = currentRoundMatches.find(m => m.court === 'top')
  const bottomMatch = currentRoundMatches.find(m => m.court === 'bottom')
  const isFinalRound = currentRoundNum === event.totalRounds
  const roundInPlay = event.status === 'in_progress'

  const placements = finalPlacements(event.matches, event.totalRounds)

  const history = [...event.matches]
    .filter(m => m.status === 'complete')
    .sort((a, b) => a.round - b.round || a.court.localeCompare(b.court))

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-black tracking-tight flex-1">Snake and Ladders</h1>
        {event.status === 'complete' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-600/15 text-zinc-600 font-bold uppercase tracking-wide">
            Complete
          </span>
        )}
      </div>

      {/* Final standings */}
      {event.status === 'complete' && placements && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-zinc-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final Standings</span>
          </div>
          <div className="space-y-2">
            {placements.map((pair, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-7 text-[11px] font-mono font-bold text-muted-foreground text-right shrink-0">
                  {PLACEMENT_LABELS[i]}
                </span>
                <TeamPill p1={pair[0]} p2={pair[1]} byId={byId} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round progress */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Round {Math.min(currentRoundNum, event.totalRounds)}/{event.totalRounds}
        </span>
        <span className="font-mono text-muted-foreground">
          {event.matches.filter(m => m.status === 'complete').length}/{event.totalRounds * 2} matches
        </span>
      </div>

      {roundInPlay && isFinalRound && (
        <div className="glass rounded-xl p-3 border border-zinc-600/40 flex items-center gap-2.5">
          <Flag className="h-4 w-4 text-zinc-600 shrink-0" />
          <div className="text-[11px] text-muted-foreground">
            <span className="text-zinc-600 font-bold">Final round — last 2 matches.</span> Top court winner
            takes 1st, loser takes 2nd. Bottom court winner takes 3rd, loser takes 4th.
          </div>
        </div>
      )}

      {/* Courts */}
      {roundInPlay && topMatch && (
        <CourtCard label="Top Court" icon="up" match={topMatch} eventId={event.id} target={event.target} byId={byId} />
      )}
      {roundInPlay && bottomMatch && (
        <CourtCard label="Bottom Court" icon="down" match={bottomMatch} eventId={event.id} target={event.target} byId={byId} />
      )}

      {/* Match history */}
      {history.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match History</span>
          </div>
          <div className="divide-y divide-zinc-900/5">
            {history.map(m => (
              <div key={m.id} className="py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 font-mono text-muted-foreground">
                    R{m.round} {m.court === 'top' ? '↑' : '↓'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">
                    {firstName(m.teamAPlayer1Id)} &amp; {firstName(m.teamAPlayer2Id)}
                  </span>
                  <span className="w-16 shrink-0 text-center font-mono font-bold text-foreground">
                    {m.teamAScore}–{m.teamBScore}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-right text-muted-foreground">
                    {firstName(m.teamBPlayer1Id)} &amp; {firstName(m.teamBPlayer2Id)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CourtCard({
  label,
  icon,
  match,
  eventId,
  target,
  byId,
}: {
  label: string
  icon: 'up' | 'down'
  match: SnakeLaddersMatchView
  eventId: string
  target: number
  byId: PlayerLookup
}) {
  const router = useRouter()
  const [teamAScore, setTeamAScore] = useState('')
  const [teamBScore, setTeamBScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const Icon = icon === 'up' ? ArrowUp : ArrowDown

  const submitScore = async () => {
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
      const res = await fetch(`/api/events/snake-ladders/${eventId}/matches/${match.id}`, {
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

  if (match.status === 'complete') {
    return (
      <div className="glass rounded-xl p-3 opacity-70">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
          <span className="text-xs font-mono font-bold shrink-0">{match.teamAScore}–{match.teamBScore}</span>
          <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3 border border-zinc-600/30">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-600" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>

      <div className="flex items-center gap-3">
        <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={teamAScore}
          onChange={e => setTeamAScore(e.target.value)}
          onFocus={e => e.target.select()}
          placeholder="0"
          className="w-14 shrink-0 bg-zinc-900/5 border border-zinc-900/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-zinc-600/60"
        />
      </div>
      <div className="flex items-center gap-3">
        <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={teamBScore}
          onChange={e => setTeamBScore(e.target.value)}
          onFocus={e => e.target.select()}
          placeholder="0"
          className="w-14 shrink-0 bg-zinc-900/5 border border-zinc-900/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-zinc-600/60"
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-center">
        First to {target} — winner&apos;s score is {target}, the other lower
      </div>

      {error && <div className="text-xs text-red-600 text-center">{error}</div>}

      <button
        onClick={submitScore}
        disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-600 text-white hover:bg-zinc-600/90 disabled:opacity-40 transition-all"
      >
        {submitting ? 'Saving...' : 'Save Score'}
      </button>
    </div>
  )
}
