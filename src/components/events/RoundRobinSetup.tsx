'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, MapPin, History, ChevronRight, ChevronDown, Minus, Plus, CalendarDays } from 'lucide-react'
import SwipeToDeleteRow from '@/components/shared/SwipeToDeleteRow'
import RosterBuilder from '@/components/events/RosterBuilder'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventSummary } from '@/lib/round-robin-store'
import { ROUND_ROBIN_MIN_TEAMS, ROUND_ROBIN_MAX_TEAMS, ROUND_ROBIN_MAX_COURTS, LEAGUE_SCORING, GAMES_TARGETS, POINTS_TOTALS, DEFAULT_POINTS, roundRobinMatchCount, usableCourts, generateRoundRobinSchedule, type LeagueScoring, type OneOffScoring } from '@/lib/round-robin'

interface Props {
  players: PlayerWithStats[]
  knownPlayers: PlayerWithStats[]
  pastEvents: RoundRobinEventSummary[]
  meId: string
}


export default function RoundRobinSetup({ players, knownPlayers, pastEvents, meId }: Props) {
  const router = useRouter()
  const [teamCount, setTeamCount] = useState(4)
  const [target, setTarget] = useState<number>(6)
  // One-off events: a race to N games, or an odd number of points per match.
  const [oneOffScoring, setOneOffScoring] = useState<OneOffScoring>('games')
  const [points, setPoints] = useState(DEFAULT_POINTS)
  const [courts, setCourts] = useState(1)
  const [league, setLeague] = useState(false)
  const [scoring, setScoring] = useState<LeagueScoring>('games')
  const [roster, setRoster] = useState<PlayerWithStats[]>(() => players.filter(p => p.id === meId))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = new Map([...knownPlayers, ...players].map(p => [p.id, p]))
  const needed = teamCount * 2
  // Courts beyond half the teams could never all be used, so fewer teams
  // quietly brings the choice down.
  const maxUsable = usableCourts(teamCount, ROUND_ROBIN_MAX_COURTS)
  const courtsInUse = usableCourts(teamCount, courts)
  const dummyTeams = Array.from({ length: teamCount }, (_, i) => [`${i}a`, `${i}b`] as [string, string])
  const rounds = new Set(generateRoundRobinSchedule(dummyTeams, courtsInUse, league).map(f => f.round)).size
  // Leagues follow ranked-match rules: PadelTrack users only.
  const guestsInLeague = league ? roster.filter(p => p.isGuest) : []

  // Fewer teams drops the players beyond the new size; more just makes room.
  // Works from the latest count, so quick repeated taps all register.
  const changeTeamCount = (delta: number) => {
    setTeamCount(current => {
      const next = Math.min(ROUND_ROBIN_MAX_TEAMS, Math.max(ROUND_ROBIN_MIN_TEAMS, current + delta))
      setRoster(r => r.slice(0, next * 2))
      return next
    })
  }

  // Players are paired in the order they're added: 1st & 2nd form team 1,
  // 3rd & 4th team 2, and so on.
  const teams: [string, string][] = []
  for (let i = 0; i + 1 < roster.length; i += 2) teams.push([roster[i].id, roster[i + 1].id])

  const deleteEvent = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/events/round-robin/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const startEvent = async () => {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/events/round-robin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams,
          courts: courtsInUse,
          league,
          scoring: league ? scoring : oneOffScoring,
          target: league ? undefined : oneOffScoring === 'points' ? points : target,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start event')
        setStarting(false)
        return
      }
      router.push(`/events/round-robin/${data.id}`)
    } catch {
      setError('Network error')
      setStarting(false)
    }
  }

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-neon-blue" />
          <h1 className="text-2xl font-black tracking-tight">Round Robin</h1>
        </div>
      </div>

      {/* Team count */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teams</div>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => changeTeamCount(-1)}
            disabled={teamCount <= ROUND_ROBIN_MIN_TEAMS}
            aria-label="One fewer team"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 disabled:opacity-30 transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className="text-xl font-black tabular-nums">{teamCount} teams</div>
            <div className="text-[11px] text-muted-foreground">{roundRobinMatchCount(teamCount)} matches · {teamCount * 2} players</div>
          </div>
          <button
            onClick={() => changeTeamCount(1)}
            disabled={teamCount >= ROUND_ROBIN_MAX_TEAMS}
            aria-label="One more team"
            className="h-10 w-10 rounded-xl flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 disabled:opacity-30 transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Courts (a one-off event) or a league players arrange themselves */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venue / Type</div>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Courts</span>
            <select
              value={courtsInUse}
              onChange={e => { setCourts(Number(e.target.value)); setLeague(false) }}
              onFocus={() => setLeague(false)}
              className={`w-full appearance-none py-2.5 pl-3 pr-8 rounded-xl text-sm font-bold transition-all focus:outline-none ${
                league ? 'bg-zinc-900/5 text-muted-foreground' : 'bg-neon-blue text-white'
              }`}
            >
              {Array.from({ length: ROUND_ROBIN_MAX_COURTS }, (_, i) => i + 1).map(n => (
                <option key={n} value={n} disabled={n > maxUsable} className="text-zinc-900">
                  {n} court{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 ${league ? 'text-muted-foreground' : 'text-white'}`} />
          </label>
          <button
            onClick={() => setLeague(true)}
            aria-pressed={league}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              league ? 'bg-neon-blue text-white' : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            League
          </button>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {league ? (
            <span>
              {rounds} rounds — players arrange each match themselves, in any order. They enter their own scores and the other pair confirms, like a ranked match (no rating change). PadelTrack users only.
            </span>
          ) : (
            <span>
              One-off event: {courtsInUse} court{courtsInUse > 1 ? 's' : ''} at once · {rounds} round{rounds > 1 ? 's' : ''}. The organiser or players enter scores. Guests welcome.
            </span>
          )}
        </div>
      </div>

      {/* Scoring: a race to N games for one-off events; three formats for leagues */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Each match</div>
        {league ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LEAGUE_SCORING) as LeagueScoring[]).map(k => (
                <button
                  key={k}
                  onClick={() => setScoring(k)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold leading-tight transition-all ${
                    scoring === k ? 'bg-neon-blue text-white' : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
                  }`}
                >
                  {LEAGUE_SCORING[k]}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              {scoring === 'games' && 'Race to 4 games — first pair to 4 wins'}
              {scoring === 'set' && 'One set to 6, win by 2, tie-break at 6–6'}
              {scoring === 'match' && 'Best of 3 sets, each to 6 with a tie-break at 6–6'}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {GAMES_TARGETS.map(t => (
                <button
                  key={t}
                  onClick={() => { setOneOffScoring('games'); setTarget(t) }}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    oneOffScoring === 'games' && target === t ? 'bg-neon-blue text-white' : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
                  }`}
                >
                  {t} games
                </button>
              ))}
              <button
                onClick={() => setOneOffScoring('points')}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  oneOffScoring === 'points' ? 'bg-neon-blue text-white' : 'bg-zinc-900/5 text-muted-foreground hover:bg-zinc-900/10'
                }`}
              >
                Points
              </button>
            </div>
            {oneOffScoring === 'points' && (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">Points per match</span>
                <span className="relative">
                  <select
                    value={points}
                    onChange={e => setPoints(Number(e.target.value))}
                    className="appearance-none bg-zinc-900/5 rounded-xl py-2 pl-4 pr-9 font-bold focus:outline-none"
                  >
                    {POINTS_TOTALS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </span>
              </label>
            )}
            <div className="text-[10px] text-muted-foreground text-center">
              {oneOffScoring === 'points'
                ? `Play ${points} points — the scores add up to ${points} (e.g. ${Math.ceil(points / 2) + 1}–${Math.floor(points / 2) - 1}). The leaderboard counts points won.`
                : `Race to ${target} — not best of, first team to ${target} wins the match`}
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <RosterBuilder players={players} roster={roster} onChange={setRoster} max={needed} hint={`${needed} — each row is a team`} valid={roster.length === needed && !guestsInLeague.length} usersOnly={league} />
        {teams.length > 0 && (
          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Teams</div>
            {teams.map((team, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 font-mono text-zinc-500">T{i + 1}</span>
                <span className="font-semibold">
                  {byId.get(team[0])?.name.split(' ')[0]} &amp; {byId.get(team[1])?.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 text-center">{error}</div>}
      <button
        onClick={startEvent}
        disabled={starting || roster.length !== needed || guestsInLeague.length > 0}
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-neon-blue text-white hover:bg-neon-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {starting ? 'Generating schedule...' : league ? 'Start League' : 'Start Event'}
      </button>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Events</span>
          </div>
          <div className="space-y-2">
            {pastEvents.map(e => {
              const leader = e.leaderboard[0]
              const card = (
                <Link
                  href={`/events/round-robin/${e.id}`}
                  className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-zinc-900/10 hover:border-zinc-900/20 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">
                        {new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {e.league ? 'League' : `${e.courts} court${e.courts > 1 ? 's' : ''}`}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                          e.status === 'complete'
                            ? 'bg-neon-blue/15 text-neon-blue'
                            : 'bg-amber-600/15 text-amber-600'
                        }`}
                      >
                        {e.status === 'complete' ? 'Complete' : `Match ${e.matchesComplete}/${e.matchesTotal}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {leader ? (
                        <>
                          <span className="text-zinc-900/70 font-medium">
                            {byId.get(leader.playerIds[0])?.name.split(' ')[0]} &amp;{' '}
                            {byId.get(leader.playerIds[1])?.name.split(' ')[0]}
                          </span>{' '}
                          leads with {leader.points} pts
                        </>
                      ) : (
                        'No scores yet'
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </Link>
              )

              if (e.status === 'in_progress') {
                return (
                  <SwipeToDeleteRow key={e.id} onDelete={() => deleteEvent(e.id)} deleting={deletingId === e.id}>
                    {card}
                  </SwipeToDeleteRow>
                )
              }
              return <div key={e.id}>{card}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
