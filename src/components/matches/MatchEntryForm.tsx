'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, X, CheckCircle2, Clock, RotateCcw, ChevronDown, Trash2 } from 'lucide-react'
import { getInitials, setWinner, isSetComplete } from '@/lib/utils'
import PlayerPicker from '@/components/shared/PlayerPicker'
import InviteButton from '@/components/players/InviteButton'
import type { PlayerWithStats } from '@/types'
import type { LocationOption } from '@/lib/store'

export interface Lineup {
  partner: PlayerWithStats
  opponents: [PlayerWithStats, PlayerWithStats]
}

interface Props {
  me: PlayerWithStats
  // Ordered most-played-with first.
  players: PlayerWithStats[]
  lineups: Lineup[]
  // Where you've played, most recently played first.
  recentLocations: LocationOption[]
  // Every listed club, A–Z.
  clubs: LocationOption[]
  // 'new' (default): record a played match, or set one up for a future date.
  // 'edit': changing a match before its score is confirmed — a scheduled one
  // (the organiser) or a pending one (whoever entered the score, scores
  // included). 'score': entering the score of a scheduled match that has
  // started (line-up and date fixed).
  mode?: 'new' | 'edit' | 'score'
  existing?: {
    matchId: string
    // You first, then your partner, then the opponents.
    slots: [string, string, string, string]
    // You're on the match's B side, so scores are swapped when saved.
    flipped: boolean
    startsAt: string
    location: LocationOption | null
    isRanked: boolean
    status: 'scheduled' | 'pending' | 'complete'
    // A pending match's score, from your side (your games first).
    sets?: { us: number; them: number }[]
    incomplete?: boolean
    // Whether the edit page offers Delete.
    canDelete?: boolean
  }
}

// Each set is two typed digits, kept as strings so a box can be empty.
type SetInput = { us: string; them: string }
type SetScore = { us: number; them: number }
type Slots = [string, string, string, string] // you, partner, opponent, opponent

const EMPTY_SETS: SetInput[] = [{ us: '', them: '' }, { us: '', them: '' }, { us: '', them: '' }]
const SLOT_LABELS = ['You', 'Partner', 'Opponent', 'Opponent']

// The viewer's local date as YYYY-MM-DD (the server runs in UTC).
function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateLabel(value: string, today: string): string {
  if (!value || value === today) return 'Today'
  if (value === localDate(-1)) return 'Yesterday'
  const d = new Date(`${value}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) })
}

export default function MatchEntryForm({ me, players: initialPlayers, lineups, recentLocations, clubs, mode = 'new', existing }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useState(initialPlayers)
  const [slots, setSlots] = useState<Slots>(existing?.slots ?? [me.id, '', '', ''])
  const fixedLineup = mode === 'score'
  // Editing a match that already has a score (not a scheduled one).
  const editingScore = mode === 'edit' && existing?.status === 'pending'
  const [sets, setSets] = useState<SetInput[]>(EMPTY_SETS)
  // Score boxes in order: set 1 us, set 1 them, set 2 us, ... for auto-advance.
  const scoreRefs = useRef<(HTMLInputElement | null)[]>([])
  // Which slot the player picker is filling, or null when it's closed.
  const [pickTarget, setPickTarget] = useState<number | null>(null)
  const [today, setToday] = useState('')
  const [playedOn, setPlayedOn] = useState('')
  // Start time, for a match set up ahead ('HH:MM', the viewer's local time).
  const [time, setTime] = useState('')
  const [now, setNow] = useState(0)
  const [location, setLocation] = useState<LocationOption | null>(existing ? existing.location : recentLocations[0] ?? null)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [isRanked, setIsRanked] = useState(existing?.isRanked ?? true)
  // Play stopped before either pair won two sets: save with no winner.
  const [incomplete, setIncomplete] = useState(false)
  const [savedIncomplete, setSavedIncomplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ status: 'scheduled' | 'pending' | 'complete'; ptrDelta: number; invites: { name: string; claimToken: string }[]; outcome?: string } | null>(null)

  useEffect(() => {
    const t = localDate()
    setToday(t)
    setNow(Date.now())
    if (existing) {
      // The scheduled start, in the viewer's own timezone.
      const d = new Date(existing.startsAt)
      setPlayedOn(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
      if (existing.sets?.length) {
        setSets(EMPTY_SETS.map((blank, i) => (existing.sets![i] ? { us: String(existing.sets![i].us), them: String(existing.sets![i].them) } : blank)))
        setIncomplete(!!existing.incomplete)
      }
    } else {
      setPlayedOn(t)
    }
    // Only when the match changes — background refreshes pass a new object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.matchId])

  // A start in the future makes it a match set up ahead: no score yet.
  const startsAt = playedOn && time ? new Date(`${playedOn}T${time}`) : null
  const futureDay = !!today && playedOn > today
  const isFuture = (mode === 'edit' && !editingScore) || (mode === 'new' && (futureDay || (!!startsAt && playedOn === today && startsAt.getTime() > now)))
  const startOk = !!startsAt && startsAt.getTime() > Date.now()

  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const nextSlot = [1, 2, 3].find(i => !slots[i])
  const allPicked = nextSlot === undefined
  // Ranked guests count without joining.
  const guestsInLineup = slots.map(id => byId.get(id)).filter((p): p is PlayerWithStats => !!p && p.isGuest && !p.isRankedGuest)

  // A set only counts once it's a finished score (6-4, 7-5, 7-6…).
  const parsed: (SetScore | null)[] = sets.map(x => {
    if (x.us === '' || x.them === '') return null
    const sc = { us: Number(x.us), them: Number(x.them) }
    return isSetComplete(sc.us, sc.them) ? sc : null
  })
  const won = (s: SetScore | null) => (s ? setWinner(s.us, s.them) : null)
  // A third set only appears at one set all.
  const splitAfterTwo = !!parsed[0] && !!parsed[1] && won(parsed[0]) !== won(parsed[1])
  const visibleSets = splitAfterTwo ? 3 : 2
  const counted = parsed.slice(0, visibleSets)
  const setsUs = counted.filter(s => won(s) === 'A').length
  const setsThem = counted.filter(s => won(s) === 'B').length
  const unfinished = sets.slice(0, visibleSets).findIndex((x, i) => x.us !== '' && x.them !== '' && !parsed[i])
  const winner = setsUs >= 2 ? 'A' : setsThem >= 2 ? 'B' : null
  // Every set with both scores in, finished or not — what an incomplete
  // match saves.
  const entered = sets.slice(0, visibleSets)
    .filter(x => x.us !== '' && x.them !== '')
    .map(x => ({ us: Number(x.us), them: Number(x.them) }))
  const canSaveIncomplete = allPicked && !winner && entered.some(x => x.us + x.them > 0)
  const savingIncomplete = incomplete && canSaveIncomplete
  const ready = isFuture ? allPicked && startOk : allPicked && (!!winner || savingIncomplete)

  // Once the last player is in, jump straight to the first score box. This
  // runs inside the tap handler (not after a delay) so phones open the
  // number keyboard — iOS only does that for focus during a user gesture.
  const goToScoresIfReady = (next: Slots) => {
    if (!isFuture && next.every(Boolean) && sets[0].us === '') scoreRefs.current[0]?.focus()
  }
  const fill = (p: PlayerWithStats, slot: number) => {
    const next = [...slots] as Slots
    next[slot] = p.id
    setSlots(next)
    goToScoresIfReady(next)
  }
  const clearSlot = (i: number) => {
    if (i === 0 || fixedLineup) return
    const next = [...slots] as Slots
    next[i] = ''
    setSlots(next)
  }
  const applyLineup = (l: Lineup) => {
    setPlayers(prev => {
      const add = [l.partner, ...l.opponents].filter(p => !prev.some(x => x.id === p.id))
      return [...prev, ...add]
    })
    const next: Slots = [me.id, l.partner.id, l.opponents[0].id, l.opponents[1].id]
    setSlots(next)
    goToScoresIfReady(next)
  }

  const typeScore = (set: number, side: 'us' | 'them', raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = sets.map(x => ({ ...x }))
    next[set][side] = digit
    // Clear set 3 if the first two no longer split.
    const p = next.map(x => (x.us !== '' && x.them !== '' && isSetComplete(+x.us, +x.them) ? { us: +x.us, them: +x.them } : null))
    if (!(p[0] && p[1] && won(p[0]) !== won(p[1]))) next[2] = { us: '', them: '' }
    setSets(next)
    setError('')
    if (digit === '') return
    // Jump to the next box once a number is in; after set 2 that's set 3
    // only if it just became needed, otherwise close the keyboard.
    const idx = set * 2 + (side === 'us' ? 0 : 1)
    const nextBox = scoreRefs.current[idx + 1]
    if (nextBox) {
      nextBox.focus()
      return
    }
    // The next box may be set 3, which only renders after this update.
    setTimeout(() => {
      const appeared = scoreRefs.current[idx + 1]
      if (appeared) appeared.focus()
      else scoreRefs.current[idx]?.blur()
    }, 0)
  }

  // Backspace in an empty box steps back to the previous one.
  const scoreKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && e.currentTarget.value === '' && idx > 0) {
      e.preventDefault()
      scoreRefs.current[idx - 1]?.focus()
    }
  }

  const reset = () => {
    setSaved(null)
    setSlots([me.id, '', '', ''])
    setSets(EMPTY_SETS)
    setIsRanked(true)
    setError('')
  }

  // Edit mode: delete the match (for a scheduled one, its organiser calls it
  // off and everyone is told).
  const cancelMatch = async () => {
    if (!existing || !confirm(existing.status === 'scheduled' ? 'Delete this match? Everyone in it will be told.' : 'Delete this match?')) return
    setSubmitting(true)
    const res = await fetch(`/api/matches/${existing.matchId}`, { method: 'DELETE' })
    setSubmitting(false)
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Could not cancel the match')
    else { router.push('/matches'); router.refresh() }
  }

  // Throws away whatever's been entered and leaves the page.
  const discard = () => {
    reset()
    if (window.history.length > 1) router.back()
    else router.push('/matches')
  }

  const handleSubmit = async () => {
    if (!ready) return
    setSubmitting(true)
    setError('')
    try {
      if (editingScore && existing) {
        // You're always the first slot, so your side is A.
        const res = await fetch(`/api/matches/${existing.matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamAPlayer1Id: slots[0], teamAPlayer2Id: slots[1], teamBPlayer1Id: slots[2], teamBPlayer2Id: slots[3],
            sets: savingIncomplete
              ? entered.map(x => ({ teamAGames: x.us, teamBGames: x.them }))
              : counted.filter(Boolean).map(x => ({ teamAGames: x!.us, teamBGames: x!.them })),
            winner: savingIncomplete ? null : winner,
            incomplete: savingIncomplete,
            playedOn: playedOn || undefined,
            ...(startsAt && playedOn === today && { startsAt: startsAt.toISOString() }),
            location: location?.label, clubId: location?.clubId ?? undefined, isRanked,
          }),
        })
        const d = await res.json()
        if (!res.ok) setError(d.error || 'Could not save the changes')
        else { router.push('/matches'); router.refresh() }
        return
      }
      if (mode === 'edit' && existing) {
        const res = await fetch(`/api/matches/${existing.matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamAPlayer1Id: slots[0], teamAPlayer2Id: slots[1], teamBPlayer1Id: slots[2], teamBPlayer2Id: slots[3],
            startsAt: startsAt!.toISOString(), location: location?.label, clubId: location?.clubId ?? undefined, isRanked,
          }),
        })
        const d = await res.json()
        if (!res.ok) setError(d.error || 'Could not save the changes')
        else { router.push('/matches'); router.refresh() }
        return
      }
      if (mode === 'score' && existing) {
        // Scores are entered from your side; the match stores them A v B.
        const raw = savingIncomplete ? entered : counted.filter(Boolean).map(x => x!)
        const flip = existing.flipped
        const res = await fetch(`/api/matches/${existing.matchId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sets: raw.map(x => (flip ? { teamAGames: x.them, teamBGames: x.us } : { teamAGames: x.us, teamBGames: x.them })),
            winner: savingIncomplete ? null : flip ? (winner === 'A' ? 'B' : 'A') : winner,
            incomplete: savingIncomplete,
          }),
        })
        const d = await res.json()
        if (!res.ok) setError(d.error || 'Could not save the score')
        else {
          // No refresh here: once settled, this page shows a different screen,
          // which would replace the result below.
          setSaved({ status: d.outcome === 'complete' || d.outcome === 'confirmed' ? 'complete' : 'pending', ptrDelta: 0, invites: [], outcome: d.outcome })
          setSavedIncomplete(savingIncomplete)
        }
        return
      }
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAPlayer1Id: slots[0], teamAPlayer2Id: slots[1],
          teamBPlayer1Id: slots[2], teamBPlayer2Id: slots[3],
          sets: savingIncomplete
            ? entered.map(s => ({ teamAGames: s.us, teamBGames: s.them }))
            : counted.filter(Boolean).map(s => ({ teamAGames: s!.us, teamBGames: s!.them })),
          winner: savingIncomplete ? null : winner,
          incomplete: savingIncomplete,
          playedOn: playedOn || undefined,
          ...(isFuture && startsAt && { startsAt: startsAt.toISOString(), sets: [], winner: null, incomplete: false }),
          // An earlier time today: when it was played.
          ...(!isFuture && startsAt && playedOn === today && { startsAt: startsAt.toISOString() }),
          location: location?.label,
          clubId: location?.clubId ?? undefined,
          isRanked,
        }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Could not save the match')
      else {
        setSaved({ status: d.status, ptrDelta: d.ptrDelta, invites: d.invites ?? [] })
        setSavedIncomplete(savingIncomplete)
        router.refresh()
      }
    } catch {
      setError('No connection — try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    // Same rule as the server (confirmerIds): the other pair, or your partner
    // if both opponents are guests.
    const opponents = [byId.get(slots[2]), byId.get(slots[3])].filter(p => p && !p.isGuest)
    const confirmers = (opponents.length ? opponents : [byId.get(slots[1])].filter(p => p && !p.isGuest)).map(p => p!.name.split(' ')[0])
    const told = slots.slice(1).map(id => byId.get(id)).filter(p => p && !p.isGuest).map(p => p!.name.split(' ')[0])
    const SCORE_OUTCOMES: Record<string, { title: string; text: string }> = {
      complete: { title: 'Score saved', text: 'It’s in Match Centre. Friendlies don’t change anyone’s rating.' },
      pending: { title: 'Sent for confirmation', text: `${confirmers.join(' or ') || 'Your opponents'} can confirm it — or enter it themselves, and if it matches yours it’s confirmed.` },
      confirmed: { title: 'Confirmed', text: 'The other pair entered the same score, so it’s confirmed.' },
      partner: { title: 'Score saved', text: 'Your partner entered the same score. It’s waiting for an opponent to confirm.' },
      disputed: { title: 'Scores don’t match', text: 'Someone entered a different score. The players will be asked to pick the right one in Match Centre.' },
    }
    const outcome = saved.outcome ? SCORE_OUTCOMES[saved.outcome] : null
    if (saved.status === 'scheduled' || outcome) {
      return (
        <div className="py-16 flex flex-col items-center text-center gap-3">
          {saved.status === 'scheduled' ? <CalendarDays className="h-14 w-14 text-orange-500" /> : <CheckCircle2 className="h-14 w-14 text-orange-500" />}
          <h2 className="text-xl font-black">{saved.status === 'scheduled' ? 'Match set up' : outcome!.title}</h2>
          <p className="text-sm text-zinc-500 max-w-xs">
            {saved.status === 'scheduled'
              ? <>{told.length ? `We’ve let ${told.join(' & ')} know. ` : ''}Everyone gets a reminder the day before, and a prompt to add the score afterwards.{saved.invites.length > 0 && ` ${saved.invites.map(i => i.name.split(' ')[0]).join(' & ')} ${saved.invites.length > 1 ? 'aren’t' : 'isn’t'} on PadelTrack — send them the invite.`}</>
              : <>{outcome!.text}{savedIncomplete && ' As it didn’t finish, it won’t change anyone’s rating.'}</>}
          </p>
          {saved.invites.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {saved.invites.map(i => <InviteButton key={i.claimToken} name={i.name} claimToken={i.claimToken} ranked={isRanked} />)}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Link href="/matches" className="px-5 py-3 rounded-xl text-sm font-semibold bg-zinc-900 text-white">Match Centre</Link>
            {mode === 'new' && <button onClick={reset} className="px-5 py-3 rounded-xl text-sm font-semibold border border-zinc-300">Record another</button>}
          </div>
        </div>
      )
    }
    return (
      <div className="py-16 flex flex-col items-center text-center gap-3">
        {!isRanked ? (
          <>
            <CheckCircle2 className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Friendly saved</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              It’s in Match Centre{savedIncomplete ? ' as incomplete' : ''}. Friendlies don’t change anyone’s rating.
              {saved.invites.length > 0 && ` Invite ${saved.invites.map(i => i.name.split(' ')[0]).join(' & ')} to see it on their profile.`}
            </p>
            {saved.invites.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {saved.invites.map(i => <InviteButton key={i.claimToken} name={i.name} claimToken={i.claimToken} ranked={false} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <Clock className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Sent for confirmation</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              {confirmers.length
                ? `${confirmers.join(' or ')} needs to confirm the score.`
                : guestsInLineup.length
                  ? 'Your opponents confirm the score once they’ve joined.'
                  : 'PadelTrack admin will confirm the score.'}
              {guestsInLineup.length > 0
                ? ` ${guestsInLineup.map(g => g.name.split(' ')[0]).join(' & ')} ${guestsInLineup.length > 1 ? 'aren’t' : 'isn’t'} on PadelTrack yet — invite them within 48 hours or it becomes a friendly.`
                : opponents.length > 0 && ' If nobody responds within 48 hours, it confirms automatically.'}
              {savedIncomplete && ' As it didn’t finish, it won’t change anyone’s rating — only sets and games count.'}
            </p>
            {saved.invites.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {saved.invites.map(i => <InviteButton key={i.claimToken} name={i.name} claimToken={i.claimToken} />)}
              </div>
            )}
          </>
        )}
        <div className="flex gap-2 mt-4">
          <Link href="/matches" className="px-5 py-3 rounded-xl text-sm font-semibold bg-zinc-900 text-white">Match Centre</Link>
          <button onClick={reset} className="px-5 py-3 rounded-xl text-sm font-semibold border border-zinc-300">Record another</button>
        </div>
      </div>
    )
  }

  const renderSlot = (i: number) => {
    const p = byId.get(slots[i])
    const isNext = i === nextSlot
    if (!p) {
      return (
        <button
          key={i}
          onClick={() => setPickTarget(i)}
          className={`h-14 rounded-xl border-2 border-dashed text-xs font-semibold transition w-full ${isNext ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-zinc-200 text-zinc-400'}`}
        >
          {SLOT_LABELS[i]}
        </button>
      )
    }
    return (
      <button
        key={i}
        onClick={() => clearSlot(i)}
        disabled={i === 0 || fixedLineup}
        className="relative h-14 flex items-center gap-1.5 pl-2 pr-3 rounded-xl bg-white border border-zinc-200 w-full min-w-0 text-left active:scale-[0.98] transition"
        aria-label={i === 0 ? 'You' : `Remove ${p.name}`}
      >
        <span className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
          {getInitials(p.name)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate">{i === 0 ? 'You' : p.name.split(' ')[0]}</span>
          {p.isGuest && <span className="block text-[10px] text-zinc-400">Guest</span>}
        </span>
        {i !== 0 && !fixedLineup && <X className="absolute top-1.5 right-1.5 h-2.5 w-2.5 text-zinc-300" />}
      </button>
    )
  }

  return (
    <div className="pt-5 pb-32 space-y-5">
      {/* Title + when/where — defaults mean these are usually zero taps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">{mode === 'edit' ? 'Edit match' : mode === 'score' ? 'Add score' : 'New match'}</h1>
          {mode === 'edit' ? (
            existing?.canDelete !== false && (
              <button onClick={cancelMatch} disabled={submitting} className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-red-600 px-2 py-1 -mr-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )
          ) : (
            <button onClick={discard} className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-red-600 px-2 py-1 -mr-2">
              <Trash2 className="h-3.5 w-3.5" /> Discard
            </button>
          )}
        </div>
        {mode === 'score' ? (
          <p className="text-sm text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 text-orange-500" />{startsAt ? startsAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-orange-500" />{location.label}</span>}
            <span>{isRanked ? 'Ranked' : 'Friendly'}</span>
          </p>
        ) : (
        <div className="flex flex-wrap gap-2">
          <label className="relative flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-full bg-zinc-100 text-sm font-semibold cursor-pointer shrink-0">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            {today ? dateLabel(playedOn, today) : 'Today'}
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            <input autoComplete="off"
              type="date"
              value={playedOn}
              max={today ? (editingScore ? today : localDate(365)) : undefined}
              min={mode === 'edit' && !editingScore ? today : '2000-01-01'}
              onChange={e => setPlayedOn(e.target.value || today)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Date"
            />
          </label>
          {/* Start time: needed for a future date; on today, a later time sets it up ahead. */}
          {(playedOn >= today || (mode === 'edit' && !editingScore)) && (
            <label className={`relative flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-full text-sm font-semibold cursor-pointer shrink-0 ${futureDay && !time ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-300' : 'bg-zinc-100'}`}>
              <Clock className="h-4 w-4 text-orange-500" />
              {/* Today with no time picked means "played now": enter the score. */}
              {time || (futureDay || (mode === 'edit' && !editingScore) ? 'Add time' : 'Now')}
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="time" value={time} step={300}
                onChange={e => { setTime(e.target.value); setNow(Date.now()) }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Start time"
              />
            </label>
          )}
          {mode === 'new' && playedOn === today && time && (
            <button
              onClick={() => setTime('')}
              className="flex items-center gap-1 h-10 px-3 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500 hover:text-zinc-900 shrink-0"
            >
              <X className="h-3 w-3" /> Now
            </button>
          )}
          <button
            onClick={() => { setEditingLocation(v => !v); setLocationQuery('') }}
            className={`flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-full bg-zinc-100 text-sm font-semibold min-w-0 ${location ? '' : 'text-zinc-500'}`}
          >
            <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="truncate">{location?.label || 'Add location'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          </button>
        </div>
        )}
        {editingLocation && mode !== 'score' && (
          <LocationPanel
            recent={recentLocations}
            clubs={clubs}
            selected={location}
            query={locationQuery}
            onQuery={setLocationQuery}
            onPick={l => { setLocation(l); setEditingLocation(false) }}
            onClose={() => setEditingLocation(false)}
          />
        )}
      </div>

      {/* Play again: one tap fills partner + both opponents */}
      {lineups.length > 0 && mode === 'new' && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Play again
          </h2>
          {/* scroll-px keeps snapped tiles in line with the page margin; the
              trailing spacer lets the last tile scroll fully into view. */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lineups.map(l => (
              <button
                key={[l.partner.id, ...l.opponents.map(o => o.id)].join('|')}
                onClick={() => applyLineup(l)}
                className="snap-start shrink-0 w-[200px] text-left rounded-2xl bg-zinc-900 text-white p-3 active:scale-[0.98] transition"
              >
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">With</div>
                <div className="text-sm font-bold truncate">{l.partner.name.split(' ')[0]}</div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 mt-1.5">Against</div>
                <div className="text-sm font-semibold text-orange-400 truncate">{l.opponents.map(o => o.name.split(' ')[0]).join(' & ')}</div>
              </button>
            ))}
            <span aria-hidden className="shrink-0 w-px -ml-2" />
          </div>
        </section>
      )}

      {/* Teams, then one row per set: your games under your team, theirs
          under the opponents, with the set label above. Typing a digit jumps to
          the next box (set 1 yours, set 1 theirs, set 2 yours…). Set 3 only
          appears at one set all. */}
      <section className="glass rounded-2xl p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1">
          <div className="space-y-2">{renderSlot(0)}{renderSlot(1)}</div>
          <span className="text-center text-[9px] font-black text-zinc-300">VS</span>
          <div className="space-y-2">{renderSlot(2)}{renderSlot(3)}</div>

          {!isFuture && Array.from({ length: visibleSets }, (_, i) => {
            const result = won(parsed[i])
            return [0, 1].map(team => {
              const side = team === 0 ? 'us' : 'them'
              const idx = i * 2 + team
              const winning = (team === 0 && result === 'A') || (team === 1 && result === 'B')
              const input = (
                <input
                  key={`${i}-${side}`}
                  ref={el => { scoreRefs.current[idx] = el }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  enterKeyHint={idx === visibleSets * 2 - 1 ? 'done' : 'next'}
                  value={sets[i][side]}
                  onChange={e => typeScore(i, side, e.target.value)}
                  onKeyDown={e => scoreKeyDown(idx, e)}
                  onFocus={e => e.target.select()}
                  placeholder="–"
                  aria-label={`Set ${i + 1} ${team === 0 ? 'your' : 'their'} games`}
                  className={`h-11 w-full min-w-0 rounded-xl border text-center font-mono text-xl font-black focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition placeholder:text-zinc-300 ${
                    winning ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-zinc-200 bg-zinc-50 text-zinc-900'
                  }`}
                />
              )
              return team === 0
                ? [
                    <span key={`${i}-label`} className={`col-span-3 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-none ${i === 0 ? 'pt-5' : 'pt-0.5'} -mb-0.5`}>Set {i + 1}</span>,
                    input,
                    <span key={`${i}-gap`} />,
                  ]
                : input
            })
          })}
        </div>
        {isFuture && (
          <p className="mt-3 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2.5 text-xs text-orange-900 leading-relaxed">
            <span className="font-semibold block">This match is for the future</span>
            Add the score after it’s played. Everyone gets a reminder the day before{mode === 'new' ? ', and we’ll let them know they’ve been added' : ''}.
          </p>
        )}
        {!isFuture && unfinished >= 0 && !savingIncomplete && (
          <p className="text-xs text-amber-700 mt-2">Set {unfinished + 1} isn’t a finished score yet (e.g. 6–4, 7–5 or 7–6).</p>
        )}
        {!isFuture && canSaveIncomplete && (
          <label className="mt-3 flex items-start gap-2.5 rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox" checked={incomplete} onChange={e => setIncomplete(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-orange-500 shrink-0"
            />
            <span className="text-xs text-zinc-600 leading-relaxed">
              <span className="font-semibold text-zinc-900 block">Match didn’t finish</span>
              Save it as incomplete: no winner and no rating change.
            </span>
          </label>
        )}
      </section>

      {/* Ranked (default) or friendly */}
      {mode !== 'score' && <section className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100" role="radiogroup" aria-label="Match type">
        {[{ ranked: true, title: 'Ranked' }, { ranked: false, title: 'Friendly' }].map(o => (
          <button
            key={o.title}
            role="radio"
            aria-checked={isRanked === o.ranked}
            onClick={() => setIsRanked(o.ranked)}
            className={`h-10 rounded-lg text-sm font-bold transition ${isRanked === o.ranked ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
          >
            {o.title}
          </button>
        ))}
      </section>}

      {isRanked && guestsInLineup.length > 0 && (
        <p className="text-xs text-zinc-500 leading-relaxed -mt-2 px-1">
          <span className="font-semibold text-zinc-700">{guestsInLineup.map(g => g.name.split(' ')[0]).join(' & ')} {guestsInLineup.length > 1 ? 'aren’t' : 'isn’t'} on PadelTrack.</span>{' '}
          To count as ranked, {guestsInLineup.length > 1 ? 'they each need' : 'they need'} to join within 48 hours of saving, or it becomes a friendly. You’ll get an invite link to send after you save.
        </p>
      )}

      {/* Save bar — fixed to the bottom like a native app */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-zinc-200 [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="text-sm font-semibold text-red-600 truncate">{error}</div>
            ) : isFuture ? (
              <div className="text-xs text-zinc-500">{!allPicked ? 'Add all four players' : !time ? 'Add a start time' : !startOk ? 'Pick a time in the future' : startsAt!.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            ) : savingIncomplete ? (
              <>
                <div className="text-sm font-black text-zinc-900">Incomplete {setsUs}–{setsThem}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">{entered.map(s => `${s.us}-${s.them}`).join('  ')}</div>
              </>
            ) : winner ? (
              <>
                <div className={`text-sm font-black ${winner === 'A' ? 'text-orange-600' : 'text-zinc-900'}`}>{winner === 'A' ? 'You win' : 'You lose'} {setsUs}–{setsThem}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">{counted.filter(Boolean).map(s => `${s!.us}-${s!.them}`).join('  ')}</div>
              </>
            ) : (
              <div className="text-xs text-zinc-500">{!allPicked ? 'Add all four players' : 'Score the sets'}</div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!ready || submitting}
            className="h-12 px-6 rounded-xl font-bold text-sm bg-orange-500 text-white disabled:opacity-40 active:scale-[0.98] transition"
          >
            {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : isFuture ? 'Save match for future' : savingIncomplete ? 'Save incomplete' : mode === 'score' ? 'Save score' : isRanked ? 'Save match' : 'Save friendly'}
          </button>
        </div>
      </div>

      <PlayerPicker
        open={pickTarget !== null}
        title={pickTarget !== null ? `Add ${SLOT_LABELS[pickTarget].toLowerCase()}` : 'Add player'}
        players={players}
        excludeIds={slots.filter(Boolean)}
        guestHint="Not on PadelTrack — for a ranked match they need to join within 48 hours, or it becomes a friendly"
        askGuestLevel
        onClose={() => setPickTarget(null)}
        onSelect={p => { if (pickTarget !== null) fill(p, pickTarget); setPickTarget(null) }}
        onDiscovered={p => setPlayers(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])}
      />
    </div>
  )
}

// Search the listed clubs. Places you've played come first, most recent
// first; then every other club A–Z. "My venue isn't listed" saves free text
// with no club — those are reviewed monthly for clubs to add (see
// scripts/unlisted-venues.ts).
function LocationPanel({ recent, clubs, selected, query, onQuery, onPick, onClose }: {
  recent: LocationOption[]
  clubs: LocationOption[]
  selected: LocationOption | null
  query: string
  onQuery: (q: string) => void
  onPick: (l: LocationOption | null) => void
  onClose: () => void
}) {
  const [unlisted, setUnlisted] = useState(false)
  const [venue, setVenue] = useState('')
  const q = query.trim().toLowerCase()
  const matches = (l: LocationOption) => !q || l.label.toLowerCase().includes(q)
  const recentClubIds = new Set(recent.map(l => l.clubId).filter(Boolean))
  const played = recent.filter(matches)
  const others = clubs.filter(c => !recentClubIds.has(c.clubId) && matches(c))
  const isSelected = (l: LocationOption) => !!selected && (l.clubId ? l.clubId === selected.clubId : !selected.clubId && l.label === selected.label)

  const row = (l: LocationOption) => (
    <button
      key={l.clubId ?? l.label}
      onClick={() => onPick(l)}
      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm ${isSelected(l) ? 'bg-orange-50 text-orange-700 font-semibold' : 'hover:bg-zinc-50'}`}
    >
      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
      <span className="truncate">{l.label}</span>
    </button>
  )

  const saveVenue = () => { if (venue.trim()) onPick({ clubId: null, label: venue.trim() }) }

  if (unlisted) {
    return (
      <div className="glass rounded-2xl p-3 space-y-2">
        <label htmlFor="venue" className="text-xs font-medium text-zinc-600 block px-1">Where did you play?</label>
        <div className="flex gap-2">
          <input autoComplete="off"
            id="venue"
            autoFocus
            value={venue}
            onChange={e => setVenue(e.target.value.slice(0, 60))}
            onKeyDown={e => { if (e.key === 'Enter') saveVenue() }}
            placeholder="Club name, Area"
            enterKeyHint="done"
            className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
          <button onClick={saveVenue} disabled={!venue.trim()} className="px-4 rounded-xl text-sm font-bold bg-zinc-900 text-white disabled:opacity-40">Save</button>
        </div>
        <p className="text-[11px] text-zinc-500 px-1">We’ll look at adding it to the list of clubs. Tip: write it as Club name, Area</p>
        <button onClick={() => setUnlisted(false)} className="px-1 text-xs font-medium text-zinc-400">Back to the list</button>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-3 space-y-2">
      <div className="flex gap-2">
        <input autoComplete="off"
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value.slice(0, 60))}
          onKeyDown={e => { const first = played[0] ?? others[0]; if (e.key === 'Enter' && q && first) onPick(first) }}
          placeholder="Search clubs"
          enterKeyHint="done"
          className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
        />
        <button onClick={onClose} className="px-4 rounded-xl text-sm font-bold bg-zinc-900 text-white">Done</button>
      </div>
      <div className="max-h-60 overflow-y-auto -mx-1 px-1 space-y-3">
        {played.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1">Recently played</div>
            {played.map(row)}
          </div>
        )}
        {others.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1">{played.length ? 'All clubs' : 'Clubs'}</div>
            {others.map(row)}
          </div>
        )}
        {q && played.length === 0 && others.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-3">No clubs match “{query.trim()}”</p>
        )}
        {/* Last item in the list, styled like a club row. */}
        <button
          onClick={() => { setVenue(query.trim()); setUnlisted(true) }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-orange-600 hover:bg-zinc-50"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          My venue isn’t listed
        </button>
      </div>
      {selected && (
        <button onClick={() => onPick(null)} className="px-1 text-xs font-medium text-zinc-400">Clear location</button>
      )}
    </div>
  )
}
