'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Zap, Clock, Check, X, Trash2, Timer, MapPin, CheckCircle2, Circle, CalendarDays, Pencil, PenLine, AlertTriangle } from 'lucide-react'
import { getInitials, getFullScore, setWinner, formatRatingDelta } from '@/lib/utils'
import InviteButton from '@/components/players/InviteButton'
import type { MatchWithPlayers, PlayerWithStats } from '@/types'

interface Props {
  match: MatchWithPlayers
  canConfirm?: boolean
  canDelete?: boolean
  // Larger layout used for the most recent match at the top of Match Centre.
  featured?: boolean
  // The viewer, for matches set up in advance: whether they organised it, and
  // which disputed score they may pick.
  viewer?: { playerId: string; userId: string }
  // Shown in Admin: no player actions (add score, edit, cancel).
  readOnly?: boolean
}

function hoursLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'any moment'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `${h}h`
  return `${Math.max(1, Math.round(ms / 60_000))}m`
}

export default function MatchCard({ match, canConfirm, canDelete, featured, viewer, readOnly }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'confirm' | 'delete' | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  // Times depend on the viewer's clock and timezone, so they're only rendered
  // in the browser (the server runs in UTC and would disagree).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const teamA = [match.teamAPlayer1, match.teamAPlayer2]
  const teamB = [match.teamBPlayer1, match.teamBPlayer2]
  // Incomplete matches have no winner: neither side is dimmed or marked.
  const aWon = match.winner === 'A'
  const bWon = match.winner === 'B'
  const pending = match.status === 'pending'
  // Editable until the score's confirmed, by whoever entered it — and not
  // once a second score is in (a partner's match, or a dispute).
  const canEdit = pending && !!viewer && match.recordedById === viewer.userId && !match.scoreConfirmed && !match.disputed &&
    match.scoreReports.filter(r => r.status === 'open').length <= 1

  const act = async (kind: 'confirm' | 'delete', reportId?: string) => {
    setBusy(kind)
    setError('')
    const res = await fetch(kind === 'confirm' ? `/api/matches/${match.id}/confirm` : `/api/matches/${match.id}`, {
      method: kind === 'confirm' ? 'POST' : 'DELETE',
      ...(reportId && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId }) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Something went wrong')
      setBusy(null)
      return
    }
    router.refresh()
  }

  const Avatar = ({ p, size }: { p: PlayerWithStats; size: 'sm' | 'lg' }) => (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white ${size === 'lg' ? 'h-12 w-12 text-sm ring-2 ring-white' : 'h-7 w-7 text-[10px]'}`}
      style={{ backgroundColor: p.avatarColor }}
      title={p.name}
    >
      {getInitials(p.name)}
    </div>
  )

  const Badges = () => (
    <div className="flex items-center gap-2 shrink-0">
      {pending && (
        <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1 whitespace-nowrap">
          <Clock className="h-2.5 w-2.5" /> PENDING
        </span>
      )}
      {match.incomplete && (
        <span className="text-[10px] bg-zinc-200 text-zinc-700 rounded px-1.5 py-0.5 font-semibold whitespace-nowrap" title="Didn’t finish — no winner, doesn’t affect ratings">
          INCOMPLETE
        </span>
      )}
      {!match.isRanked && (
        <span className="text-[10px] bg-sky-100 text-sky-800 rounded px-1.5 py-0.5 font-semibold whitespace-nowrap" title="Doesn’t affect ratings">
          FRIENDLY
        </span>
      )}
      {!pending && match.autoConfirmed && (
        <span className="text-[10px] bg-zinc-100 text-zinc-600 rounded px-1.5 py-0.5 font-semibold" title="Nobody confirmed within 48 hours">
          AUTO-CONFIRMED
        </span>
      )}
      {!pending && match.isUpset && (
        <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1">
          <Zap className="h-2.5 w-2.5" /> UPSET
        </span>
      )}
      {/* Before it's confirmed, whoever entered the score can change it. */}
      {canEdit && (
        <Link
          href={`/matches/${match.id}/edit`}
          className={`transition-colors ${featured ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
          aria-label="Edit match"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      )}
      {/* Only pending matches can be removed; confirmed ones stay on record. */}
      {canDelete && pending && !canConfirm && (!match.organiserId || viewer?.userId === match.organiserId) && (
        <button
          onClick={() => setConfirmingDelete(v => !v)}
          className={`transition-colors ${featured ? 'text-zinc-500 hover:text-red-400' : 'text-zinc-400 hover:text-red-600'}`}
          aria-label="Cancel match"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  const Footer = () => (
    <>
      {pending && !match.disputed && (() => {
        // Two things make a pending match ranked: the score confirmed, and
        // every guest joining PadelTrack (ranked guests don't need to).
        const guestNames = match.guests.filter(g => !g.ranked).map(g => g.name.split(' ')[0])
        const confirmers = match.awaitingConfirmationFrom ?? []
        const scoreText = match.scoreConfirmed
          ? 'Score confirmed'
          : canConfirm
            ? 'Waiting for you to confirm the score'
            : confirmers.length
              ? `Waiting for ${confirmers.join(' or ')} to confirm the score`
              : guestNames.length
                ? `${guestNames.join(' or ')} confirms the score after joining`
                : match.autoConfirms
                  ? 'Waiting for the other pair to confirm the score'
                  : 'Waiting for PadelTrack admin to confirm the score'
        const left = mounted ? hoursLeft(match.autoConfirmAt) : '…'
        const muted = featured ? 'text-zinc-400' : 'text-zinc-500'
        return (
          <div className="mt-3 space-y-1.5 text-[11px]">
            <Step done={match.scoreConfirmed} text={scoreText} muted={muted} />
            {guestNames.length > 0 && (
              <Step done={false} text={`Waiting for ${guestNames.join(' & ')} to join PadelTrack`} muted={muted} />
            )}
            {match.guests.some(g => g.claimToken) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {match.guests.filter(g => g.claimToken).map(g => (
                  <InviteButton key={g.id} name={g.name} claimToken={g.claimToken!} dark={featured} counts={g.ranked} />
                ))}
              </div>
            )}
            <div className={`flex items-center gap-1.5 ${muted}`}>
              <Timer className="h-3 w-3 shrink-0" />
              {guestNames.length > 0
                ? <>Becomes a friendly in {left} unless {guestNames.join(' & ')} {guestNames.length > 1 ? 'join' : 'joins'}</>
                : !match.autoConfirms
                  ? <>Needs confirming — it won&apos;t confirm itself</>
                  : canConfirm
                    ? <>Confirms automatically in {left} if you don&apos;t respond</>
                    : <>Confirms automatically in {left}</>}
            </div>
          </div>
        )
      })()}

      {!pending && match.becameFriendly && (
        <div className={`mt-3 text-[11px] ${featured ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Became a friendly — {match.guests.length ? `${match.guests.map(g => g.name.split(' ')[0]).join(' & ')} didn’t` : 'a guest didn’t'} join PadelTrack within 48 hours.
        </div>
      )}

      {/* Friendlies, and ranked guests' matches: guests can still join to get
          the match on their profile. */}
      {!pending && match.guests.some(g => g.claimToken) && (
        <div className="mt-3 space-y-1.5 text-[11px]">
          {!match.becameFriendly && (
            <div className={featured ? 'text-zinc-400' : 'text-zinc-500'}>
              {match.guests.filter(g => g.claimToken).map(g => g.name.split(' ')[0]).join(' & ')} {match.guests.filter(g => g.claimToken).length > 1 ? 'aren’t' : 'isn’t'} on PadelTrack yet
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {match.guests.filter(g => g.claimToken).map(g => (
              <InviteButton key={g.id} name={g.name} claimToken={g.claimToken!} dark={featured} ranked={match.isRanked} counts={g.ranked} />
            ))}
          </div>
        </div>
      )}

      {pending && match.disputed && <Dispute />}

      {canConfirm && !match.disputed && (
        <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2">
          <span className="text-xs text-zinc-600 flex-1">Is this result right?</span>
          {/* Set up in advance: a wrong score is answered with the right one. */}
          {match.organiserId ? (
            <Link href={`/matches/${match.id}/score`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50">
              <PenLine className="h-3.5 w-3.5" /> Different score
            </Link>
          ) : (
          <button onClick={() => act('delete')} disabled={!!busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50">
            <X className="h-3.5 w-3.5" /> {busy === 'delete' ? 'Rejecting…' : 'Reject'}
          </button>
          )}
          <button onClick={() => act('confirm')} disabled={!!busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {busy === 'confirm' ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${featured ? 'border-white/10' : 'border-zinc-200'}`}>
          <span className={`text-xs flex-1 ${featured ? 'text-zinc-300' : 'text-zinc-600'}`}>
            {pending ? 'Cancel this match?' : 'Delete this match? Everyone’s rating change will be reversed.'}
          </span>
          <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50">Keep</button>
          <button onClick={() => act('delete')} disabled={!!busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </>
  )

  // No result yet (scheduled) or none at all (incomplete): neither side dimmed.
  const noResult = match.status === 'scheduled' || match.incomplete || match.disputed
  // An open spot (a match set up ahead) shows as a dashed circle.
  const Team = ({ players, won, align }: { players: (PlayerWithStats | null)[]; won: boolean; align: 'left' | 'right' }) => (
    <div className={`flex-1 min-w-0 ${align === 'right' ? 'text-right' : ''} ${won || noResult ? '' : 'opacity-60'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {align === 'right' && won && <span className="text-[10px] text-orange-600 font-bold mr-1">WIN</span>}
        {players.map((p, i) => p
          ? <Avatar key={p.id} p={p} size="sm" />
          : <div key={`open-${i}`} className="h-7 w-7 rounded-full border-2 border-dashed border-zinc-300" title="Open spot" />)}
        {align === 'left' && won && <span className="text-[10px] text-orange-600 font-bold ml-1">WIN</span>}
      </div>
      <div className="text-xs text-zinc-600 truncate">{players.map(p => (p ? p.name.split(' ')[0] : 'Open')).join(' & ')}</div>
    </div>
  )

  // Two different scores: each player on the other pair from a submitter can
  // say that one's right.
  const Dispute = () => {
    const mySide = viewer ? ([match.teamAPlayer1Id, match.teamAPlayer2Id].includes(viewer.playerId) ? 'A' : [match.teamBPlayer1Id, match.teamBPlayer2Id].includes(viewer.playerId) ? 'B' : null) : null
    const open = match.scoreReports.filter(r => r.status === 'open')
    // In the card's order: the left pair's games first.
    const score = (r: (typeof open)[number]) => r.sets.map(x => `${x.teamAGames}-${x.teamBGames}`).join('  ')
    return (
      <div className={`mt-3 pt-3 border-t space-y-2 ${featured ? 'border-white/10' : 'border-amber-200'}`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5" /> The scores entered don’t match — which is right?
        </div>
        {open.map(r => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-bold">{score(r)}{r.incomplete && <span className="ml-1.5 text-[10px] font-sans text-zinc-500">didn’t finish</span>}</div>
              <div className="text-[11px] text-zinc-500">Entered by {r.submittedBy.split(' ')[0]}</div>
            </div>
            {mySide && r.side !== mySide && (
              <button onClick={() => act('confirm', r.id)} disabled={!!busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 shrink-0">
                <Check className="h-3.5 w-3.5" /> This one
              </button>
            )}
          </div>
        ))}
        <p className="text-[11px] text-zinc-500">Someone from the other pair to whoever entered a score picks it. It won’t confirm on its own.</p>
      </div>
    )
  }

  // Set up in advance and not scored yet: when and where, who's playing, and
  // for the organiser an edit link. Once it has started, "Add score".
  if (match.status === 'scheduled') {
    const start = new Date(match.playedAt)
    const started = mounted && start.getTime() <= Date.now()
    const isOrganiser = !!viewer && match.organiserId === viewer.userId
    const openSpots = teamA.concat(teamB).filter(p => !p).length
    return (
      <div className={`ptr-card ${started ? '!border-orange-300 !bg-orange-50/50' : ''}`}>
        <div className="flex items-center mb-3 gap-2">
          <span className="flex-1 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 min-w-0">
            <CalendarDays className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            <span className="shrink-0 whitespace-nowrap">{mounted ? format(start, 'EEE d MMM, HH:mm') : '\u00a0'}</span>
            {match.location && (
              <span className="min-w-0 flex items-center gap-0.5 ml-1 font-normal text-zinc-400" title={match.location}>
                <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{match.location}</span>
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!match.isRanked && <span className="text-[10px] bg-sky-100 text-sky-800 rounded px-1.5 py-0.5 font-semibold">FRIENDLY</span>}
            {/* The organiser can change or cancel it until a score is in. */}
            {isOrganiser && !readOnly && (
              <>
                <Link href={`/matches/${match.id}/edit`} className="text-zinc-400 hover:text-zinc-700" aria-label="Edit match"><Pencil className="h-3.5 w-3.5" /></Link>
                <button onClick={() => setConfirmingDelete(v => !v)} className="text-zinc-400 hover:text-red-600" aria-label="Delete match"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Team players={teamA} won={false} align="left" />
          <div className="text-[10px] font-black text-zinc-300 shrink-0">VS</div>
          <Team players={teamB} won={false} align="right" />
        </div>
        {started && readOnly ? (
          <div className="mt-2 text-[11px] text-zinc-500">Started — no score entered yet.</div>
        ) : openSpots > 0 && started ? (
          <div className="mt-3 pt-3 border-t border-orange-200 flex items-center gap-2">
            <span className="text-xs text-zinc-500 flex-1">Waiting for players</span>
            {isOrganiser && (
              <Link href={`/matches/${match.id}/edit`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600">
                <Pencil className="h-3.5 w-3.5" /> Add players
              </Link>
            )}
          </div>
        ) : started ? (
          <div className="mt-3 pt-3 border-t border-orange-200 flex items-center gap-2">
            <span className="text-xs text-zinc-600 flex-1">How did it go?</span>
            <Link href={`/matches/${match.id}/score`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600">
              <PenLine className="h-3.5 w-3.5" /> Add score
            </Link>
          </div>
        ) : openSpots > 0 ? (
          <div className="mt-2 text-[11px] text-zinc-400">{openSpots} spot{openSpots > 1 ? 's' : ''} open</div>
        ) : (
          match.guests.length > 0 && <div className="mt-2 text-[11px] text-zinc-400">{match.guests.map(g => g.name.split(' ')[0]).join(' & ')} not on PadelTrack</div>
        )}
        {confirmingDelete && (
          <div className="mt-3 pt-3 border-t border-zinc-200 flex items-center gap-2">
            <span className="text-xs flex-1 text-zinc-600">Cancel this match? Everyone in it will be told.</span>
            <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white">Keep</button>
            <button onClick={() => act('delete')} disabled={!!busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-50">{busy === 'delete' ? 'Cancelling…' : 'Cancel match'}</button>
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    )
  }

  if (featured) {
    const sets = match.sets.filter(s => s.teamAGames + s.teamBGames > 0)
    return (
      <div className="rounded-2xl bg-zinc-900 text-white p-5 shadow-md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-orange-500 font-bold">Latest match</div>
            <div className="text-xs text-zinc-400">{mounted ? format(new Date(match.playedAt), new Date(match.playedAt).getFullYear() === new Date().getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy') : '\u00a0'}</div>
            {match.location && <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5 min-w-0" title={match.location}><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{match.location}</span></div>}
          </div>
          <Badges />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[teamA, teamB].map((team, i) => {
            const won = i === 0 ? aWon : bWon
            return (
              <div key={i} className={`flex flex-col items-center text-center gap-2 ${i === 1 ? 'order-3' : ''} ${won || match.incomplete ? '' : 'opacity-60'}`}>
                <div className="flex -space-x-2">
                  {team.map(p => p && <Avatar key={p.id} p={p} size="lg" />)}
                </div>
                <div className="text-sm font-semibold leading-tight">{team.map(p => p?.name.split(' ')[0] ?? 'Open').join(' & ')}</div>
                {won && <span className="text-[10px] font-black tracking-widest text-orange-500">WINNERS</span>}
              </div>
            )
          })}
          <div className="order-2 flex flex-col items-center gap-1">
            {sets.map(s => {
              const w = setWinner(s.teamAGames, s.teamBGames)
              return (
                <div key={s.setNumber} className="font-mono text-2xl font-black tabular-nums">
                  <span className={w === 'A' ? 'text-white' : 'text-zinc-500'}>{s.teamAGames}</span>
                  <span className="text-zinc-600 mx-1.5">–</span>
                  <span className={w === 'B' ? 'text-white' : 'text-zinc-500'}>{s.teamBGames}</span>
                </div>
              )
            })}
          </div>
        </div>

        {!pending && match.viewerDelta !== undefined && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Your rating</span>
            <span className={`font-mono font-bold ${match.viewerDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatRatingDelta(match.viewerDelta)}
            </span>
          </div>
        )}
        <Footer />
      </div>
    )
  }

  return (
    <div className={`ptr-card ${pending ? '!border-amber-300 !bg-amber-50/50' : ''}`}>
      {/* One row: when, then the venue cut short with "…" before the badges. */}
      <div className="flex items-center gap-2 mb-3">
        <span className="flex-1 min-w-0 flex items-center gap-2 text-xs text-zinc-500">
          <span className="shrink-0 whitespace-nowrap">{mounted ? formatDistanceToNow(new Date(match.playedAt), { addSuffix: true }) : '\u00a0'}</span>
          {match.location && (
            <span className="min-w-0 flex items-center gap-0.5 text-zinc-400" title={match.location}>
              <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{match.location}</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!pending && match.viewerDelta !== undefined && (
            <span className={`text-[11px] font-mono font-bold ${match.viewerDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatRatingDelta(match.viewerDelta)}
            </span>
          )}
          <Badges />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Team players={teamA} won={aWon && !match.disputed} align="left" />
        <div className="font-mono font-bold text-sm text-zinc-900 shrink-0">{match.disputed ? <span className="text-xs text-amber-700">Disputed</span> : getFullScore(match.sets)}</div>
        <Team players={teamB} won={bWon && !match.disputed} align="right" />
      </div>

      <Footer />
    </div>
  )
}

function Step({ done, text, muted }: { done: boolean; text: string; muted: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${done ? 'text-emerald-600' : muted}`}>
      {done ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
      {text}
    </div>
  )
}
