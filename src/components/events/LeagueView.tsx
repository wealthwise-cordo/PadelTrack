'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Check, X, Clock } from 'lucide-react'
import TeamPill, { type Players } from '@/components/events/TeamPill'
import { LEAGUE_SCORING, LEAGUE_GAMES_TARGET, leagueStandings, leagueMatchActions, type LeagueScoring } from '@/lib/round-robin'
import type { PlayerWithStats } from '@/types'
import type { RoundRobinEventView as EventData, RoundRobinMatchView as Match } from '@/lib/round-robin-store'

const CONFIRM_HOURS = 48

// A league: ranked-match rules without the rating change. Players see every
// round, enter scores for their own matches, and confirm (or reject) scores
// the other pair entered; unanswered scores confirm themselves after 48 h.
export default function LeagueView({ event, players, meId }: { event: EventData; players: PlayerWithStats[]; meId: string }) {
  const byId: Players = new Map(players.map(p => [p.id, p]))
  const scoring = event.scoring as LeagueScoring // leagues never use points
  const first = (id: string) => byId.get(id)?.name.split(' ')[0] ?? '—'
  const team = (a: string, b: string) => `${first(a)} & ${first(b)}`

  const standings = leagueStandings(event.teams, event.matches)
  const mine = event.matches.filter(m => [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id].includes(meId))
  const needsMe = mine.filter(m => m.status !== 'complete')
  const rounds = Array.from(new Set(event.matches.map(m => m.round))).sort((a, b) => a - b)
  const done = event.matches.filter(m => m.status === 'complete').length

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/events" className="h-8 w-8 rounded-full flex items-center justify-center bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black tracking-tight">League</h1>
          <div className="text-[11px] text-muted-foreground">
            {event.teams.length} teams · {LEAGUE_SCORING[scoring]} · {done}/{event.matches.length} played
          </div>
        </div>
        {event.status === 'complete' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-blue/15 text-neon-blue font-bold uppercase tracking-wide">Complete</span>
        )}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-neon-blue" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-muted-foreground">
              <th className="text-left font-semibold pb-1.5" colSpan={2}>Team</th>
              <th className="font-semibold pb-1.5 w-7">P</th>
              <th className="font-semibold pb-1.5 w-7">W</th>
              <th className="font-semibold pb-1.5 w-7">L</th>
              <th className="font-semibold pb-1.5 w-10 text-right">+/−</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r, i) => {
              const diff = r.gamesFor - r.gamesAgainst
              return (
                <tr key={r.teamIndex} className="border-t border-zinc-900/5">
                  <td className="py-1.5 w-5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 min-w-0"><TeamPill p1={r.playerIds[0]} p2={r.playerIds[1]} byId={byId} /></td>
                  <td className="py-1.5 text-center tabular-nums">{r.played}</td>
                  <td className="py-1.5 text-center tabular-nums font-bold">{r.won}</td>
                  <td className="py-1.5 text-center tabular-nums">{r.lost}</td>
                  <td className="py-1.5 text-right tabular-nums">{diff > 0 ? `+${diff}` : diff}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-muted-foreground mt-2">Ranked by wins, then game difference. Only confirmed results count.</p>
      </div>

      {/* The viewer's open matches: to play, to confirm, or waiting */}
      {needsMe.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-1 border border-neon-blue/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your matches</span>
            <span className="text-[10px] font-mono text-muted-foreground">{needsMe.length}</span>
          </div>
          <div className="divide-y divide-zinc-900/5">
            {needsMe
              .sort((a, b) => order(a, meId) - order(b, meId) || a.round - b.round)
              .map(m => (
                <MyMatch key={m.id} event={event} match={m} meId={meId} byId={byId} team={team} />
              ))}
          </div>
        </div>
      )}

      {event.status === 'complete' && <div className="text-center text-sm font-bold text-neon-blue py-2">🏆 League complete</div>}

      {/* Every round */}
      {rounds.map(r => (
        <div key={r} className="glass rounded-2xl p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Round {r}</div>
          <div className="divide-y divide-zinc-900/5">
            {event.matches.filter(m => m.round === r).map(m => (
              <div key={m.id} className="py-2 flex items-center gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate">{team(m.teamAPlayer1Id, m.teamAPlayer2Id)}</span>
                <span className="shrink-0 w-24 text-center">
                  {m.status === 'complete' ? (
                    <span className="font-mono font-bold">{scoreText(m)}</span>
                  ) : m.status === 'submitted' ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><Clock className="h-3 w-3" />{scoreText(m)}</span>
                  ) : (
                    <span className="text-muted-foreground/50 font-mono">vs</span>
                  )}
                </span>
                <span className="flex-1 min-w-0 truncate text-right">{team(m.teamBPlayer1Id, m.teamBPlayer2Id)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <Clock className="h-3 w-3" /> waiting for the other pair to confirm · rounds can be played in any order
      </p>
    </div>
  )
}

// Your matches: ones to confirm first, then to play, then waiting on others.
function order(m: Match, meId: string) {
  const a = leagueMatchActions(m, meId)
  return a.canConfirm ? 0 : a.canSubmit ? 1 : 2
}

// "6–4 3–6 7–5" for sets, "4–2" for a race.
function scoreText(m: Match) {
  if (m.sets && m.sets.length) return m.sets.map(s => `${s.a}–${s.b}`).join(' ')
  return `${m.teamAScore}–${m.teamBScore}`
}

function MyMatch({ event, match, meId, byId, team }: { event: EventData; match: Match; meId: string; byId: Players; team: (a: string, b: string) => string }) {
  const router = useRouter()
  const actions = leagueMatchActions(match, meId)
  const [entering, setEntering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onA = [match.teamAPlayer1Id, match.teamAPlayer2Id].includes(meId)
  const them = onA ? team(match.teamBPlayer1Id, match.teamBPlayer2Id) : team(match.teamAPlayer1Id, match.teamAPlayer2Id)
  const hoursLeft = match.submittedAt ? Math.max(1, Math.ceil(CONFIRM_HOURS - (Date.now() - new Date(match.submittedAt).getTime()) / 36e5)) : CONFIRM_HOURS

  const act = async (body: object) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/events/round-robin/${event.id}/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Something went wrong')
      else { setEntering(false); router.refresh() }
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <TeamPill p1={match.teamAPlayer1Id} p2={match.teamAPlayer2Id} byId={byId} />
          <TeamPill p1={match.teamBPlayer1Id} p2={match.teamBPlayer2Id} byId={byId} />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">Round {match.round}</span>
      </div>

      {actions.canSubmit && !entering && (
        <button onClick={() => setEntering(true)} className="w-full py-2 rounded-xl text-sm font-bold bg-neon-blue text-white">Enter score</button>
      )}
      {actions.canSubmit && entering && (
        <ScoreForm scoring={event.scoring as LeagueScoring} teamA={team(match.teamAPlayer1Id, match.teamAPlayer2Id)} teamB={team(match.teamBPlayer1Id, match.teamBPlayer2Id)} busy={busy}
          onSave={sets => act({ action: 'submit', sets })} onCancel={() => { setEntering(false); setError('') }} />
      )}

      {match.status === 'submitted' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <div className="text-xs">
            <span className="font-mono font-bold">{scoreText(match)}</span>
            <span className="text-zinc-600"> · entered by {byId.get(match.submittedById ?? '')?.name.split(' ')[0] ?? 'a player'}</span>
          </div>
          {actions.canConfirm ? (
            <>
              <div className="text-[11px] text-zinc-600">Is this right? It confirms itself in {hoursLeft} h if you don’t answer.</div>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act({ action: 'confirm' })} className="flex-1 py-2 rounded-lg text-sm font-bold bg-neon-blue text-white disabled:opacity-40 flex items-center justify-center gap-1"><Check className="h-4 w-4" />Confirm</button>
                <button disabled={busy} onClick={() => act({ action: 'clear' })} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white border border-zinc-300 disabled:opacity-40 flex items-center justify-center gap-1"><X className="h-4 w-4" />Reject</button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-600">Waiting for {them} to confirm · auto in {hoursLeft} h</span>
              <button disabled={busy} onClick={() => act({ action: 'clear' })} className="text-[11px] font-semibold text-zinc-500 underline disabled:opacity-40 shrink-0">Withdraw</button>
            </div>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-600 text-center">{error}</div>}
    </div>
  )
}

// Score boxes for the league's format: one race or set, or up to three sets.
function ScoreForm({ scoring, teamA, teamB, busy, onSave, onCancel }: {
  scoring: LeagueScoring
  teamA: string
  teamB: string
  busy: boolean
  onSave: (sets: { a: number; b: number }[]) => void
  onCancel: () => void
}) {
  const setCount = scoring === 'match' ? 3 : 1
  const [values, setValues] = useState<string[][]>(Array.from({ length: setCount }, () => ['', '']))
  const [error, setError] = useState('')
  const update = (i: number, side: 0 | 1, v: string) => setValues(vs => vs.map((row, j) => (j === i ? (side === 0 ? [v, row[1]] : [row[0], v]) : row)))

  const save = () => {
    // A full match may stop after two sets: drop a third set left empty.
    const filled = values.filter((row, i) => !(scoring === 'match' && i === 2 && row[0] === '' && row[1] === ''))
    if (filled.some(row => row[0] === '' || row[1] === '')) { setError('Fill in every set you played'); return }
    setError('')
    onSave(filled.map(row => ({ a: Number(row[0]), b: Number(row[1]) })))
  }

  const box = (i: number, side: 0 | 1, label: string) => (
    <input autoComplete="off" inputMode="numeric" pattern="[0-9]*" aria-label={label}
      value={values[i][side]} onChange={e => update(i, side, e.target.value.replace(/\D/g, '').slice(0, 1))} onFocus={e => e.target.select()} placeholder="0"
      className="w-11 bg-zinc-900/5 border border-zinc-900/10 rounded-lg py-1.5 font-mono text-center text-base font-bold focus:outline-none focus:border-neon-blue/60" />
  )

  return (
    <div className="rounded-xl border border-zinc-900/10 p-3 space-y-2">
      <div className="grid gap-x-2 gap-y-1.5 items-center" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${setCount}, auto)` }}>
        <span />
        {Array.from({ length: setCount }, (_, i) => (
          <span key={i} className="text-[10px] text-center text-muted-foreground font-semibold">{scoring === 'match' ? `Set ${i + 1}${i === 2 ? '*' : ''}` : scoring === 'set' ? 'Set' : `To ${LEAGUE_GAMES_TARGET}`}</span>
        ))}
        <span className="text-xs font-semibold truncate">{teamA}</span>
        {Array.from({ length: setCount }, (_, i) => <span key={i}>{box(i, 0, `${teamA} set ${i + 1}`)}</span>)}
        <span className="text-xs font-semibold truncate">{teamB}</span>
        {Array.from({ length: setCount }, (_, i) => <span key={i}>{box(i, 1, `${teamB} set ${i + 1}`)}</span>)}
      </div>
      {scoring === 'match' && <div className="text-[10px] text-muted-foreground">*Only if it went to a third set</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button disabled={busy} onClick={save} className="flex-1 py-2 rounded-lg text-sm font-bold bg-neon-blue text-white disabled:opacity-40">{busy ? 'Saving…' : 'Send to opponents'}</button>
        <button onClick={onCancel} className="px-4 rounded-lg text-sm font-semibold bg-zinc-900/5 text-muted-foreground">Cancel</button>
      </div>
    </div>
  )
}
