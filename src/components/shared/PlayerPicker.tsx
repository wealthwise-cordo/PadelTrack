'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface Props {
  open: boolean
  title?: string
  // Quick picks: you, your circle and the guests you've added.
  players: PlayerWithStats[]
  excludeIds?: string[]
  showRating?: boolean
  onClose: () => void
  onSelect: (player: PlayerWithStats) => void
  // Lets the parent remember newly found/created players for later picks.
  onDiscovered?: (player: PlayerWithStats) => void
}

// Choose a player: filter your quick picks, search everyone on PadelTrack, or
// add someone new as a guest by name.
export default function PlayerPicker({ open, title = 'Select player', players, excludeIds = [], showRating = true, onClose, onSelect, onDiscovered }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerWithStats[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setError('') }
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
  const quick = players.filter(p => !excluded.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
  const quickIds = new Set(players.map(p => p.id))
  const found = results.filter(p => !excluded.has(p.id) && !quickIds.has(p.id))
  const exactExists = [...players, ...results].some(p => p.name.trim().toLowerCase() === q)

  const pick = (p: PlayerWithStats) => {
    if (!quickIds.has(p.id)) onDiscovered?.(p)
    onSelect(p)
  }

  const addGuest = async () => {
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
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
      <div className="fixed z-[70] inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-5 pb-8 sm:pb-5 max-h-[80vh] flex flex-col animate-slide-in">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold">{title}</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or email, or type a new name"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          {quick.length > 0 && (
            <Section label="Your players">
              {quick.map(p => <Row key={p.id} p={p} showRating={showRating} onClick={() => pick(p)} />)}
            </Section>
          )}

          {found.length > 0 && (
            <Section label="On PadelTrack">
              {found.map(p => <Row key={p.id} p={p} showRating={showRating} onClick={() => pick(p)} />)}
            </Section>
          )}

          {searching && <p className="text-xs text-zinc-400 text-center">Searching…</p>}

          {q.length >= 1 && !exactExists && (
            <button
              onClick={addGuest}
              disabled={adding}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-orange-300 text-left hover:bg-orange-50 transition disabled:opacity-50"
            >
              <span className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-orange-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">Add “{query.trim()}” as a guest</span>
                <span className="block text-[11px] text-zinc-500">Not on PadelTrack yet — you can send them an invite link later</span>
              </span>
            </button>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          {quick.length === 0 && found.length === 0 && !q && (
            <p className="text-sm text-zinc-500 text-center py-6">Type a name to find a player or add a guest.</p>
          )}
        </div>
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
        <span className="block text-[11px] text-zinc-500">{p.isGuest ? 'Guest' : p.nickname || 'Player'}</span>
      </span>
      {showRating && <span className="font-mono text-sm font-bold text-zinc-700">{formatPTR(p.ptr)}</span>}
    </button>
  )
}
