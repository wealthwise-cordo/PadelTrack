'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface Entry {
  player: PlayerWithStats
  value: number
  display: string
}

interface Props {
  title: string
  entries: Entry[]
}

const RANK_STYLES = [
  'border border-yellow-400/30 bg-yellow-400/5',
  'border border-white/15 bg-white/3',
  'border border-white/10 bg-white/2',
]

export default function StatLeaderboard({ title, entries }: Props) {
  const [expanded, setExpanded] = useState(false)
  const top3 = entries.slice(0, 3)

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-green transition-colors"
        >
          {expanded ? 'Show less' : 'See all'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Top 3 cards */}
      <div className="grid grid-cols-3 gap-2">
        {top3.map(({ player, display }, i) => (
          <div
            key={player.id}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${RANK_STYLES[i]}`}
          >
            <div className="text-[10px] font-bold text-muted-foreground">#{i + 1}</div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-background"
              style={{ backgroundColor: player.avatarColor, boxShadow: i === 0 ? `0 0 12px ${player.avatarColor}55` : undefined }}
            >
              {getInitials(player.name)}
            </div>
            <div className="text-[10px] font-medium text-center leading-tight truncate w-full text-center">
              {player.name.split(' ')[0]}
            </div>
            <div className="font-mono font-black text-base" style={{ color: player.avatarColor }}>
              {display}
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          {entries.map(({ player, display }, i) => (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">
                {i + 1}
              </span>
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background shrink-0"
                style={{ backgroundColor: player.avatarColor }}
              >
                {getInitials(player.name)}
              </div>
              <span className="flex-1 text-sm">{player.name}</span>
              <span className="font-mono font-bold text-sm" style={{ color: player.avatarColor }}>
                {display}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
