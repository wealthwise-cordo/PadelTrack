'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import TeamPill, { type Players } from '@/components/events/TeamPill'
import LeagueView from '@/components/events/LeagueView'
import { checkOneOffScore, type OneOffScoring } from '@/lib/round-robin'
import { computeLeaderboardPoints } from '@/lib/americano'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventView as EventData, RoundRobinMatchView as Match } from '@/lib/round-robin-store'

interface Props {
  event: EventData
  players: PlayerWithStats[]
  meId: string
  // The organiser and players in the event can enter scores; viewers can't.
  canScore: boolean
}

// One-off events: one court (a single current match) or several (the current
// round, a score box per court). Leagues have their own screen.
export default function RoundRobinEventView({ event, players, meId, canScore }: Props) {
  if (event.league) return <LeagueView event={event} players={players} meId={meId} />
  return <CourtsView event={event} players={players} canScore={canScore} />
}

function CourtsView({ event, players, canScore }: Omit<Props, 'meId'>) {
  const byId: Players = new Map(players.map(p => [p.id, p]))
  const player = (id: string) => byId.get(id)
  const firstName = (id: string) => player(id)?.name.split(' ')[0] ?? '—'
  const teamName = (p1: string, p2: string) => `${firstName(p1)} & ${firstName(p2)}`

  const total = event.matches.length
  const completed = event.matches.filter(m => m.status === 'complete')
  const pending = event.matches.filter(m => m.status === 'pending')
  const rounds = Math.max(0, ...event.matches.map(m => m.round))

  const points = computeLeaderboardPoints(event.matches, event.teams.flat())
  const leaderboard = event.teams
    .map((team, teamIndex) => ({ teamIndex, team, pts: points.get(team[0]) ?? 0 }))
    .sort((a, b) => b.pts - a.pts)


  // --- Scheduled: the lowest round that still has matches to play ---------
  const currentRound = pending.length ? Math.min(...pending.map(m => m.round)) : null
  const roundMatches = (r: number) => event.matches.filter(m => m.round === r).sort((a, b) => (a.court ?? 1) - (b.court ?? 1))
  const nextRound = currentRound !== null ? pending.filter(m => m.round > currentRound).reduce<number | null>((min, m) => (min === null || m.round < min ? m.round : min), null) : null
  const singleCourt = event.courts === 1

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
          <h1 className="text-2xl font-black tracking-tight">Round Robin</h1>
          <div className="text-[11px] text-muted-foreground">
            {event.teams.length} teams · {event.scoring === 'points' ? `${event.target} points a match` : `first to ${event.target}`} · {event.courts} court{event.courts > 1 ? 's' : ''}
          </div>
        </div>
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
            return (
              <div key={row.teamIndex} className="flex items-center gap-2.5">
                <span className="w-5 text-[11px] font-mono text-muted-foreground text-right shrink-0">{i + 1}</span>
                <div className="flex -space-x-1.5 shrink-0">
                  {[p1, p2].map(p => (
                    <div
                      key={p.id}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {getInitials(p.name)}
                    </div>
                  ))}
                </div>
                <span className="flex-1 text-xs font-medium truncate">{teamName(p1.id, p2.id)}</span>
                <span className="text-sm font-mono font-bold tabular-nums">{row.pts}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scheduled: current round */}
      {currentRound !== null && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-neon-blue/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {singleCourt ? 'Current Match' : `Round ${currentRound}`}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {singleCourt ? `Match ${currentRound}/${total}` : `Round ${currentRound}/${rounds}`}
            </span>
          </div>
          <div className="space-y-3 divide-y divide-zinc-900/5">
            {roundMatches(currentRound).map(m => (
              <div key={m.id} className="pt-3 first:pt-0 space-y-2">
                {!singleCourt && (
                  <div className="text-[10px] font-bold text-neon-blue uppercase tracking-wider">Court {m.court ?? 1}</div>
                )}
                {m.status === 'complete' ? (
                  <ResultLine m={m} teamName={teamName} />
                ) : (
                  <ScoreEntry eventId={event.id} match={m} scoring={event.scoring as OneOffScoring} target={event.target} canScore={canScore} byId={byId} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled: up next */}
      {nextRound !== null && (
        <div className="glass rounded-xl p-3 opacity-70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Up Next</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {singleCourt ? `Match ${nextRound}/${total}` : `Round ${nextRound}/${rounds}`}
            </span>
          </div>
          {roundMatches(nextRound).map(m => (
            <div key={m.id} className="flex items-center justify-between gap-2">
              {!singleCourt && <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0">C{m.court ?? 1}</span>}
              <TeamPill p1={m.teamAPlayer1Id} p2={m.teamAPlayer2Id} byId={byId} />
              <span className="text-[10px] font-black text-zinc-900/25 shrink-0">VS</span>
              <TeamPill p1={m.teamBPlayer1Id} p2={m.teamBPlayer2Id} byId={byId} />
            </div>
          ))}
        </div>
      )}

      {event.status === 'complete' && (
        <div className="text-center text-sm font-bold text-neon-blue py-2">🏆 Event complete</div>
      )}

      {/* All matches / results */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Matches</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {completed.length}/{total}
          </span>
        </div>
        {(
          <div className="divide-y divide-zinc-900/5">
            {[...event.matches].map(m => (
              <div key={m.id} className="py-2 flex items-center gap-2 text-xs">
                <span className="w-9 shrink-0 font-mono text-muted-foreground">
                  {singleCourt ? m.round : `R${m.round}·${m.court ?? 1}`}
                </span>
                <span className="flex-1 min-w-0 truncate text-muted-foreground">{teamName(m.teamAPlayer1Id, m.teamAPlayer2Id)}</span>
                <span className={`w-16 shrink-0 text-center font-mono font-bold ${m.status === 'complete' ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                  {m.status === 'complete' ? `${m.teamAScore}–${m.teamBScore}` : '— vs —'}
                </span>
                <span className="flex-1 min-w-0 truncate text-right text-muted-foreground">{teamName(m.teamBPlayer1Id, m.teamBPlayer2Id)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultLine({ m, teamName }: { m: Match; teamName: (a: string, b: string) => string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex-1 min-w-0 truncate font-semibold">{teamName(m.teamAPlayer1Id, m.teamAPlayer2Id)}</span>
      <span className="font-mono font-bold">{m.teamAScore}–{m.teamBScore}</span>
      <span className="flex-1 min-w-0 truncate text-right font-semibold">{teamName(m.teamBPlayer1Id, m.teamBPlayer2Id)}</span>
    </div>
  )
}

// Two score boxes and a save button for one match. Viewers just see the teams.
function ScoreEntry({ eventId, match, scoring, target, canScore, byId, onCancel }: {
  eventId: string
  match: Match
  scoring: OneOffScoring
  target: number
  canScore: boolean
  byId: Players
  onCancel?: () => void
}) {
  const router = useRouter()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const sa = Number(a)
    const sb = Number(b)
    const invalid = a === '' || b === '' ? 'Enter both scores' : checkOneOffScore(scoring, target, sa, sb)
    if (invalid) {
      setError(invalid)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/round-robin/${eventId}/matches/${match.id}`, {
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

  const input = (value: string, set: (v: string) => void, label: string) => (
    <input autoComplete="off"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={value}
      onChange={e => set(e.target.value)}
      onFocus={e => e.target.select()}
      placeholder="0"
      className="w-14 shrink-0 bg-zinc-900/5 border border-zinc-900/10 rounded-xl px-2 py-2 font-mono text-center text-lg font-bold focus:outline-none focus:border-neon-blue/60"
    />
  )

  if (!canScore) {
    return (
      <div className="flex items-center justify-between gap-2">
        <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
        <span className="text-[10px] font-black text-zinc-900/25 shrink-0">VS</span>
        <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
        {input(a, setA, 'First team score')}
      </div>
      <div className="flex items-center justify-between gap-3">
        <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
        {input(b, setB, 'Second team score')}
      </div>
      {error && <div className="text-xs text-red-600 text-center">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-neon-blue text-white hover:bg-neon-blue/90 disabled:opacity-40 transition-all"
        >
          {submitting ? 'Saving…' : 'Save score'}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-4 rounded-xl text-sm font-semibold bg-zinc-900/5 text-muted-foreground">Cancel</button>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground text-center">
        {scoring === 'points' ? `${target} points — the two scores add up to ${target}` : `First to ${target} — winner's score is ${target}, the other lower`}
      </div>
    </div>
  )
}
