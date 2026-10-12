'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { getInitials, formatRating } from '@/lib/utils'
import LevelPicker from '@/components/shared/LevelPicker'
import { useKeyboardInset } from '@/lib/use-keyboard-inset'
import type { PlayerWithStats } from '@/types'

interface Props {
  open: boolean
  title?: string
  // Quick picks: you, your circle and the guests you've added.
  players: PlayerWithStats[]
  excludeIds?: string[]
  showRating?: boolean
  // Heading for the quick picks, e.g. "Most played with".
  quickLabel?: string
  // Line under "Add … as a guest" explaining what being a guest means here.
  guestHint?: string
  // Ask roughly what level a new guest is before adding them (used for
  // ranked matches; it only pre-fills their own choice when they sign up).
  askGuestLevel?: boolean
  onClose: () => void
  onSelect: (player: PlayerWithStats) => void
  // Lets the parent remember newly found/created players for later picks.
  onDiscovered?: (player: PlayerWithStats) => void
}

// Choose a player: your whole circle (registered players only, in the order
// given), search everyone on PadelTrack, or type a name to add a guest.
// Guests are never picked from a list — typing an existing guest's name
// reuses them server-side.
export default function PlayerPicker({ open, title = 'Select player', players, excludeIds = [], showRating = true, quickLabel = 'Your circle', guestHint = 'Not on PadelTrack — you can invite them to claim their profile later', askGuestLevel = false, onClose, onSelect, onDiscovered }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerWithStats[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  // Lift the sheet above the phone's keyboard so the search results stay visible.
  const keyboard = useKeyboardInset(open)

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setError(''); setLevelFor(null) }
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds])
  const q = query.trim().toLowerCase()
  const circle = players.filter(p => !p.isGuest)
  const quick = circle.filter(p => !excluded.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
  const quickIds = new Set(circle.map(p => p.id))
  const found = results.filter(p => !p.isGuest && !excluded.has(p.id) && !quickIds.has(p.id))
  // Guests you've already played with only appear once you type their name,
  // offered as "add as guest" so their existing profile is reused.
  const knownGuests = q.length >= 2 ? players.filter(p => p.isGuest && !excluded.has(p.id) && p.name.toLowerCase().includes(q)) : []
  // Offer a brand-new guest unless the name exactly matches someone already shown.
  const exactExists = [...circle, ...results, ...knownGuests].some(p => p.name.trim().toLowerCase() === q)

  const pick = (p: PlayerWithStats) => {
    if (!quickIds.has(p.id)) onDiscovered?.(p)
    onSelect(p)
  }

  // Name of a new guest waiting for their level to be picked, if any.
  const [levelFor, setLevelFor] = useState<string | null>(null)
  const [guestLevel, setGuestLevel] = useState<number | null>(3.5)

  const startAddGuest = () => {
    if (!askGuestLevel) return addGuest()
    setLevelFor(query.trim())
    setGuestLevel(3.5)
  }

  const addGuest = async (suggestedLevel?: number) => {
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: levelFor ?? query.trim(), suggestedLevel }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add guest'); return }
      onDiscovered?.(data)
      onSelect(data)
    } finally {
      setAdding(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-zinc-900/40 z-[60]" onClick={onClose} />
      <div className="fixed z-[70] inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5 max-h-[80vh] flex flex-col animate-slide-in"
        style={keyboard.inset > 0 ? { bottom: keyboard.inset, maxHeight: keyboard.viewportHeight - 16, paddingBottom: 20 } : undefined}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold">{title}</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input autoComplete="off"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your circle, or type a guest’s name"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        {levelFor !== null ? (
          <>
            <div className="-mx-1 px-1">
              <LevelPicker
                value={guestLevel}
                onChange={setGuestLevel}
                label={`Roughly what level is ${levelFor.split(' ')[0]}?`}
                hint="Just a starting suggestion — they pick their own level when they join"
                aboutSomeoneElse
              />
            </div>
            {/* Pinned below the list so confirming never needs a scroll. */}
            <div className="pt-3 border-t border-zinc-100 mt-2 space-y-2">
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => addGuest(undefined)} disabled={adding} className="flex-1 h-11 rounded-xl text-sm font-semibold border border-zinc-300">Not sure</button>
                <button onClick={() => addGuest(guestLevel ?? undefined)} disabled={adding} className="flex-1 h-11 rounded-xl text-sm font-bold bg-orange-500 text-white disabled:opacity-50">
                  {adding ? 'Adding…' : `Add ${levelFor.split(' ')[0]}${guestLevel !== null ? ` · ${guestLevel.toFixed(1)}` : ''}`}
                </button>
              </div>
            </div>
          </>
        ) : (
        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          {quick.length > 0 && (
            <Section label={quickLabel}>
              {quick.map(p => <Row key={p.id} p={p} showRating={showRating} onClick={() => pick(p)} />)}
            </Section>
          )}

          {found.length > 0 && (
            <Section label="On PadelTrack">
              {found.map(p => <Row key={p.id} p={p} showRating={showRating} onClick={() => pick(p)} />)}
            </Section>
          )}

          {searching && <p className="text-xs text-zinc-400 text-center">Searching…</p>}

          {knownGuests.map(g => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-orange-300 text-left hover:bg-orange-50 transition"
            >
              <span className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: g.avatarColor }}>
                {getInitials(g.name)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">Add “{g.name}” as a guest</span>
                <span className="block text-[11px] text-zinc-500">Played with before · {guestHint.charAt(0).toLowerCase() + guestHint.slice(1)}</span>
              </span>
            </button>
          ))}

          {q.length >= 1 && !exactExists && (
            <button
              onClick={startAddGuest}
              disabled={adding}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-orange-300 text-left hover:bg-orange-50 transition disabled:opacity-50"
            >
              <span className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-orange-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">Add “{query.trim()}” as a guest</span>
                <span className="block text-[11px] text-zinc-500">{guestHint}</span>
              </span>
            </button>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          {quick.length === 0 && found.length === 0 && !q && (
            <p className="text-sm text-zinc-500 text-center py-6">Your circle is empty — search for a player, or type a guest’s name.</p>
          )}
        </div>
        )}
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ p, showRating, onClick }: { p: PlayerWithStats; showRating: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition text-left">
      <span className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
        {getInitials(p.name)}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{p.name}</span>
        {p.nickname && <span className="block text-[11px] text-zinc-500">{p.nickname}</span>}
      </span>
      {showRating && <span className="font-mono text-sm font-bold text-zinc-700">{formatRating(p.ptr)}</span>}
    </button>
  )
}
