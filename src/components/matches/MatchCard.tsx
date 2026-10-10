'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { Zap, Clock, Check, X, Trash2, Timer, MapPin, CheckCircle2, Circle } from 'lucide-react'
import { getInitials, getFullScore, setWinner } from '@/lib/utils'
import InviteButton from '@/components/players/InviteButton'
import type { MatchWithPlayers, PlayerWithStats } from '@/types'

interface Props {
  match: MatchWithPlayers
  canConfirm?: boolean
  canDelete?: boolean
  // Larger layout used for the most recent match at the top of Match Centre.
  featured?: boolean
}

function hoursLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'any moment'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `${h}h`
  return `${Math.max(1, Math.round(ms / 60_000))}m`
}

export default function MatchCard({ match, canConfirm, canDelete, featured }: Props) {
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
  const aWon = match.winner === 'A'
  const pending = match.status === 'pending'

  const act = async (kind: 'confirm' | 'delete') => {
    setBusy(kind)
    setError('')
    const res = await fetch(kind === 'confirm' ? `/api/matches/${match.id}/confirm` : `/api/matches/${match.id}`, {
      method: kind === 'confirm' ? 'POST' : 'DELETE',
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
    <div className="flex items-center gap-2">
      {pending && (
        <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1 whitespace-nowrap">
          <Clock className="h-2.5 w-2.5" /> PENDING
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
      {canDelete && !canConfirm && (
        <button
          onClick={() => setConfirmingDelete(v => !v)}
          className={`transition-colors ${featured ? 'text-zinc-500 hover:text-red-400' : 'text-zinc-400 hover:text-red-600'}`}
          aria-label={pending ? 'Cancel match' : 'Delete match'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  const Footer = () => (
    <>
      {pending && (() => {
        // Two things make a pending match ranked: the score confirmed by an
        // opponent, and every guest joining PadelTrack.
        const guestNames = match.guests.map(g => g.name.split(' ')[0])
        const confirmers = match.awaitingConfirmationFrom ?? []
        const scoreText = match.scoreConfirmed
          ? 'Score confirmed'
          : canConfirm
            ? 'Waiting for you to confirm the score'
            : confirmers.length
              ? `Waiting for ${confirmers.join(' or ')} to confirm the score`
              : `${guestNames.join(' or ')} confirms the score after joining`
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
                  <InviteButton key={g.id} name={g.name} claimToken={g.claimToken!} dark={featured} />
                ))}
              </div>
            )}
            <div className={`flex items-center gap-1.5 ${muted}`}>
              <Timer className="h-3 w-3 shrink-0" />
              {guestNames.length > 0
                ? <>Becomes a friendly in {left} unless {guestNames.join(' & ')} {guestNames.length > 1 ? 'join' : 'joins'}</>
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

      {canConfirm && (
        <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2">
          <span className="text-xs text-zinc-600 flex-1">Is this result right?</span>
          <button onClick={() => act('delete')} disabled={!!busy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50">
            <X className="h-3.5 w-3.5" /> {busy === 'delete' ? 'Rejecting…' : 'Reject'}
          </button>
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

  if (featured) {
    const sets = match.sets.filter(s => s.teamAGames + s.teamBGames > 0)
    return (
      <div className="rounded-2xl bg-zinc-900 text-white p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-orange-500 font-bold">Latest match</div>
            <div className="text-xs text-zinc-400">{mounted ? format(new Date(match.playedAt), new Date(match.playedAt).getFullYear() === new Date().getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy') : '\u00a0'}</div>
            {match.location && <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{match.location}</div>}
          </div>
          <Badges />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[teamA, teamB].map((team, i) => {
            const won = (i === 0) === aWon
            return (
              <div key={i} className={`flex flex-col items-center text-center gap-2 ${i === 1 ? 'order-3' : ''} ${won ? '' : 'opacity-60'}`}>
                <div className="flex -space-x-2">
                  {team.map(p => <Avatar key={p.id} p={p} size="lg" />)}
                </div>
                <div className="text-sm font-semibold leading-tight">{team.map(p => p.name.split(' ')[0]).join(' & ')}</div>
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
              {match.viewerDelta >= 0 ? '+' : ''}{match.viewerDelta.toFixed(1)}
            </span>
          </div>
        )}
        <Footer />
      </div>
    )
  }

  const Team = ({ players, won, align }: { players: PlayerWithStats[]; won: boolean; align: 'left' | 'right' }) => (
    <div className={`flex-1 min-w-0 ${align === 'right' ? 'text-right' : ''} ${won ? '' : 'opacity-60'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {align === 'right' && won && <span className="text-[10px] text-orange-600 font-bold mr-1">WIN</span>}
        {players.map(p => <Avatar key={p.id} p={p} size="sm" />)}
        {align === 'left' && won && <span className="text-[10px] text-orange-600 font-bold ml-1">WIN</span>}
      </div>
      <div className="text-xs text-zinc-600 truncate">{players.map(p => p.name.split(' ')[0]).join(' & ')}</div>
    </div>
  )

  return (
    <div className={`ptr-card ${pending ? '!border-amber-300 !bg-amber-50/50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500">
          {mounted ? formatDistanceToNow(new Date(match.playedAt), { addSuffix: true }) : '\u00a0'}
          {match.location && <span className="inline-flex items-center gap-0.5 ml-2 text-zinc-400"><MapPin className="h-3 w-3" />{match.location}</span>}
        </span>
        <div className="flex items-center gap-2">
          {!pending && match.viewerDelta !== undefined && (
            <span className={`text-[11px] font-mono font-bold ${match.viewerDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {match.viewerDelta >= 0 ? '+' : ''}{match.viewerDelta.toFixed(1)}
            </span>
          )}
          <Badges />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Team players={teamA} won={aWon} align="left" />
        <div className="font-mono font-bold text-sm text-zinc-900 shrink-0">{getFullScore(match.sets)}</div>
        <Team players={teamB} won={!aWon} align="right" />
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
