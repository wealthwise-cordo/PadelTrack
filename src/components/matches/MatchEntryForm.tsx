'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, X, CheckCircle2, Clock, RotateCcw, ChevronDown, Trash2 } from 'lucide-react'
import { getInitials, setWinner, isSetComplete } from '@/lib/utils'
import PlayerPicker from '@/components/shared/PlayerPicker'
import InviteButton from '@/components/players/InviteButton'
import type { PlayerWithStats } from '@/types'

export interface Lineup {
  partner: PlayerWithStats
  opponents: [PlayerWithStats, PlayerWithStats]
}

interface Props {
  me: PlayerWithStats
  // Ordered most-played-with first.
  players: PlayerWithStats[]
  lineups: Lineup[]
  recentLocations: string[]
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

export default function MatchEntryForm({ me, players: initialPlayers, lineups, recentLocations }: Props) {
  const router = useRouter()
  const [players, setPlayers] = useState(initialPlayers)
  const [slots, setSlots] = useState<Slots>([me.id, '', '', ''])
  const [sets, setSets] = useState<SetInput[]>(EMPTY_SETS)
  // Score boxes in order: set 1 us, set 1 them, set 2 us, ... for auto-advance.
  const scoreRefs = useRef<(HTMLInputElement | null)[]>([])
  // Which slot the player picker is filling, or null when it's closed.
  const [pickTarget, setPickTarget] = useState<number | null>(null)
  const [today, setToday] = useState('')
  const [playedOn, setPlayedOn] = useState('')
  const [location, setLocation] = useState(recentLocations[0] ?? '')
  const [editingLocation, setEditingLocation] = useState(false)
  const [isRanked, setIsRanked] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ status: 'pending' | 'complete'; ptrDelta: number; invites: { name: string; claimToken: string }[] } | null>(null)

  useEffect(() => {
    const t = localDate()
    setToday(t)
    setPlayedOn(t)
  }, [])

  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const nextSlot = [1, 2, 3].find(i => !slots[i])
  const allPicked = nextSlot === undefined
  const guestsInLineup = slots.map(id => byId.get(id)).filter((p): p is PlayerWithStats => !!p && p.isGuest)

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
  const ready = allPicked && !!winner

  // Once the last player is in, jump straight to the first score box. This
  // runs inside the tap handler (not after a delay) so phones open the
  // number keyboard — iOS only does that for focus during a user gesture.
  const goToScoresIfReady = (next: Slots) => {
    if (next.every(Boolean) && sets[0].us === '') scoreRefs.current[0]?.focus()
  }
  const fill = (p: PlayerWithStats, slot: number) => {
    const next = [...slots] as Slots
    next[slot] = p.id
    setSlots(next)
    goToScoresIfReady(next)
  }
  const clearSlot = (i: number) => {
    if (i === 0) return
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
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamAPlayer1Id: slots[0], teamAPlayer2Id: slots[1],
          teamBPlayer1Id: slots[2], teamBPlayer2Id: slots[3],
          sets: counted.filter(Boolean).map(s => ({ teamAGames: s!.us, teamBGames: s!.them })),
          winner,
          playedOn: playedOn || undefined,
          location: location.trim() || undefined,
          isRanked,
        }),
      })
      const d = await res.json()
      if (!res.ok) setError(d.error || 'Could not save the match')
      else {
        setSaved({ status: d.status, ptrDelta: d.ptrDelta, invites: d.invites ?? [] })
        router.refresh()
      }
    } catch {
      setError('No connection — try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (saved) {
    const confirmers = [byId.get(slots[2]), byId.get(slots[3])].filter(p => p && !p.isGuest).map(p => p!.name.split(' ')[0])
    return (
      <div className="py-16 flex flex-col items-center text-center gap-3">
        {!isRanked ? (
          <>
            <CheckCircle2 className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Friendly saved</h2>
            <p className="text-sm text-zinc-500 max-w-xs">It’s in Match Centre. Friendlies don’t change anyone’s rating.</p>
          </>
        ) : (
          <>
            <Clock className="h-14 w-14 text-orange-500" />
            <h2 className="text-xl font-black">Sent for confirmation</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              {confirmers.length
                ? `${confirmers.join(' or ')} needs to confirm the score.`
                : 'Your opponents confirm the score once they’ve joined.'}
              {saved.invites.length > 0
                ? ` ${saved.invites.map(i => i.name.split(' ')[0]).join(' & ')} ${saved.invites.length > 1 ? 'aren’t' : 'isn’t'} on PadelTrack yet — invite them within 48 hours or it becomes a friendly.`
                : ' If nobody responds within 48 hours, it confirms automatically.'}
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
        disabled={i === 0}
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
        {i !== 0 && <X className="absolute top-1.5 right-1.5 h-2.5 w-2.5 text-zinc-300" />}
      </button>
    )
  }

  return (
    <div className="pt-5 pb-32 space-y-5">
      {/* Title + when/where — defaults mean these are usually zero taps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">New match</h1>
          <button onClick={discard} className="flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-red-600 px-2 py-1 -mr-2">
            <Trash2 className="h-3.5 w-3.5" /> Discard
          </button>
        </div>
        <div className="flex gap-2">
          <label className="relative flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-full bg-zinc-100 text-sm font-semibold cursor-pointer shrink-0">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            {today ? dateLabel(playedOn, today) : 'Today'}
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              value={playedOn}
              max={today}
              min="2000-01-01"
              onChange={e => setPlayedOn(e.target.value && e.target.value <= today ? e.target.value : today)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Date played"
            />
          </label>
          <button
            onClick={() => setEditingLocation(v => !v)}
            className={`flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-full bg-zinc-100 text-sm font-semibold min-w-0 ${location ? '' : 'text-zinc-500'}`}
          >
            <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="truncate">{location || 'Add location'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          </button>
        </div>
        {editingLocation && (
          <div className="glass rounded-2xl p-3 space-y-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={location}
                onChange={e => setLocation(e.target.value.slice(0, 60))}
                onKeyDown={e => { if (e.key === 'Enter') setEditingLocation(false) }}
                placeholder="Club or court name"
                enterKeyHint="done"
                className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
              <button onClick={() => setEditingLocation(false)} className="px-4 rounded-xl text-sm font-bold bg-zinc-900 text-white">Done</button>
            </div>
            {recentLocations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recentLocations.map(l => (
                  <button key={l} onClick={() => { setLocation(l); setEditingLocation(false) }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${l === location ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-zinc-200 text-zinc-600'}`}>
                    {l}
                  </button>
                ))}
                {location && (
                  <button onClick={() => setLocation('')} className="px-3 py-1.5 rounded-full text-xs font-medium text-zinc-400">Clear</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Play again: one tap fills partner + both opponents */}
      {lineups.length > 0 && (
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

          {Array.from({ length: visibleSets }, (_, i) => {
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
        {unfinished >= 0 && (
          <p className="text-xs text-amber-700 mt-2">Set {unfinished + 1} isn’t a finished score yet (e.g. 6–4, 7–5 or 7–6).</p>
        )}
      </section>

      {/* Ranked (default) or friendly */}
      <section className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100" role="radiogroup" aria-label="Match type">
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
      </section>

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
            {submitting ? 'Saving…' : isRanked ? 'Save match' : 'Save friendly'}
          </button>
        </div>
      </div>

      <PlayerPicker
        open={pickTarget !== null}
        title={pickTarget !== null ? `Add ${SLOT_LABELS[pickTarget].toLowerCase()}` : 'Add player'}
        players={players}
        excludeIds={slots.filter(Boolean)}
        guestHint="Not on PadelTrack — for a ranked match they need to join within 48 hours, or it becomes a friendly"
        onClose={() => setPickTarget(null)}
        onSelect={p => { if (pickTarget !== null) fill(p, pickTarget); setPickTarget(null) }}
        onDiscovered={p => setPlayers(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])}
      />
    </div>
  )
}
