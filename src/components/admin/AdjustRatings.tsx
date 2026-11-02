'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatRating, getInitials } from '@/lib/utils'
import AdjustRatingPanel from '@/components/players/AdjustRatingPanel'

type Player = {
  id: string; name: string; avatarColor: string; ptr: number
  pending: { levels: number; reason: string; requestedBy: string | null } | null
  coolingOffUntil: string | null
}

// Admin → Ratings: find a player and adjust their rating (by up to one level,
// with a reason). The super user's apply at once; a leveller's wait for review.
export default function AdjustRatings({ players, isSuperUser }: { players: Player[]; isSuperUser: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const term = q.trim().toLowerCase()
  const shown = term ? players.filter(p => p.name.toLowerCase().includes(term)) : players
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-3">
      <input
        value={q} onChange={e => setQ(e.target.value)} placeholder="Search players" autoComplete="off"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-500"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No players match “{q.trim()}”.</p>
      ) : (
        <ul className="glass rounded-xl divide-y divide-zinc-100">
          {shown.map(p => {
            const isOpen = open === p.id
            return (
              <li key={p.id} className="px-3 py-2.5">
                <button onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 text-left">
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
                    {getInitials(p.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                    {p.pending
                      ? <span className="block text-[11px] text-amber-700">Change waiting for review</span>
                      : p.coolingOffUntil && <span className="block text-[11px] text-zinc-400">Cooling off until {day(p.coolingOffUntil)}</span>}
                  </span>
                  <span className="font-mono text-sm font-bold shrink-0">{formatRating(p.ptr)}</span>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mt-2.5">
                    {p.coolingOffUntil && !p.pending ? (
                      <p className="text-xs text-zinc-500">Adjusted or reviewed recently, so it can’t be changed again until {day(p.coolingOffUntil)}.</p>
                    ) : (
                      <AdjustRatingPanel playerId={p.id} firstName={p.name.split(' ')[0]} ptr={p.ptr} isSuperUser={isSuperUser} pending={p.pending} startOpen />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
