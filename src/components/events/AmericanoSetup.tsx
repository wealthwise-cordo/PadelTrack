'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shuffle, Minus, Plus, MapPin } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface Props {
  players: PlayerWithStats[]
}

type ScoreMode = 'points' | 'games'

const MODE_CONFIG: Record<ScoreMode, { label: string; default: number; min: number; max: number; step: number }> = {
  points: { label: 'Points', default: 21, min: 4, max: 40, step: 1 },
  games: { label: 'Games', default: 6, min: 1, max: 12, step: 1 },
}

export default function AmericanoSetup({ players }: Props) {
  const [mode, setMode] = useState<ScoreMode>('points')
  const [target, setTarget] = useState(MODE_CONFIG.points.default)

  const changeMode = (next: ScoreMode) => {
    setMode(next)
    setTarget(MODE_CONFIG[next].default)
  }

  const { min, max, step } = MODE_CONFIG[mode]
  const adjust = (delta: number) => setTarget(t => Math.min(max, Math.max(min, t + delta)))

  return (
    <div className="pt-5 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/events"
          className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-neon-green" />
          <h1 className="text-2xl font-black tracking-tight">Americano</h1>
        </div>
      </div>

      {/* Court */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-neon-green/10 flex items-center justify-center shrink-0">
          <MapPin className="h-5 w-5 text-neon-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">1 Court</div>
          <div className="text-xs text-muted-foreground">All rounds played on a single court</div>
        </div>
      </div>

      {/* Score target */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playing to</div>

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MODE_CONFIG) as ScoreMode[]).map(m => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-neon-green text-background'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => adjust(-step)}
            disabled={target <= min}
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center min-w-[4.5rem]">
            <span className="text-3xl font-black font-mono tabular-nums">{target}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {mode === 'points' ? 'points / round' : 'games / round'}
            </span>
          </div>
          <button
            onClick={() => adjust(step)}
            disabled={target >= max}
            className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</span>
          <span className="text-xs text-muted-foreground font-mono">{players.length}/8</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {players.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-2 h-14 px-3 rounded-xl border border-white/15 bg-white/5"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                style={{ backgroundColor: p.avatarColor, boxShadow: `0 0 12px ${p.avatarColor}44` }}
              >
                {getInitials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{p.name.split(' ')[0]}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{formatPTR(p.ptr)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        disabled
        className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/5 text-muted-foreground border border-white/10 cursor-not-allowed"
      >
        Round generation coming soon
      </button>
    </div>
  )
}
