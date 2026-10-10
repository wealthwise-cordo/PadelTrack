'use client'

import { useState } from 'react'
import { Plus, X, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import PlayerPicker from '@/components/shared/PlayerPicker'
import type { PlayerWithStats } from '@/types'

interface Props {
  // Quick picks for the player picker.
  players: PlayerWithStats[]
  roster: PlayerWithStats[]
  onChange: (roster: PlayerWithStats[]) => void
  max: number
  // Shown under the heading, e.g. "4, 5, 7 or 8 players".
  hint: string
  valid: boolean
}

// Builds an event roster from users and guests. Events never affect
// ratings, so ratings aren't shown here.
export default function RosterBuilder({ players: initialPlayers, roster, onChange, max, hint, valid }: Props) {
  const [players, setPlayers] = useState(initialPlayers)
  const [picking, setPicking] = useState(false)
  const full = roster.length >= max

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Players</span>
        </div>
        <span className={`text-xs font-mono font-bold ${valid ? 'text-orange-600' : 'text-zinc-400'}`}>
          {roster.length} · {hint}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {roster.map(p => (
          <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl border border-zinc-200 bg-white">
            <span className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
              {getInitials(p.name)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold truncate">{p.name}</span>
              {p.isGuest && <span className="block text-[10px] text-zinc-400">Guest</span>}
            </span>
            <button onClick={() => onChange(roster.filter(r => r.id !== p.id))} className="h-5 w-5 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-red-100 shrink-0" aria-label={`Remove ${p.name}`}>
              <X className="h-3 w-3 text-zinc-500" />
            </button>
          </div>
        ))}
        {!full && (
          <button
            onClick={() => setPicking(true)}
            className="flex items-center justify-center gap-1.5 p-2 min-h-[46px] rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition text-xs font-semibold"
          >
            <Plus className="h-4 w-4" /> Add player
          </button>
        )}
      </div>

      <PlayerPicker
        open={picking}
        title="Add player"
        players={players}
        excludeIds={roster.map(p => p.id)}
        showRating={false}
        onClose={() => setPicking(false)}
        onSelect={p => { onChange([...roster, p]); setPicking(false) }}
        onDiscovered={p => setPlayers(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])}
      />
    </div>
  )
}
