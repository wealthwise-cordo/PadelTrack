'use client'

import Link from 'next/link'
import { Trophy, Flame } from 'lucide-react'
import PTRBadge from '@/components/shared/PTRBadge'
import SparklineChart from './SparklineChart'
import { getInitials, formatPTR, getWinRate } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

interface Props {
  player: PlayerWithStats
  index: number
  isMostInForm: boolean
}

export default function PlayerRow({ player, index, isMostInForm }: Props) {
  const rank = index + 1
  const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'text-muted-foreground'

  return (
    <Link href={`/players/${player.id}`}>
      <div className="ptr-card flex items-center gap-3 cursor-pointer group">
        {/* Rank */}
        <div className={`w-7 text-center font-bold text-sm ${rankClass}`}>
          {rank === 1 ? <Trophy className="h-4 w-4 text-yellow-400 mx-auto" /> : rank}
        </div>

        {/* Avatar */}
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-background shrink-0"
          style={{ backgroundColor: player.avatarColor }}
        >
          {getInitials(player.name)}
        </div>

        {/* Name & nickname */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate group-hover:text-neon-green transition-colors">
              {player.name}
            </span>
            {isMostInForm && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-400 bg-orange-400/10 rounded px-1 py-0.5">
                <Flame className="h-2.5 w-2.5" /> Hot
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {player.nickname} · {player.wins}W {player.losses}L · {getWinRate(player.wins, player.matchesPlayed)}%
          </div>
        </div>

        {/* Sparkline */}
        <div className="hidden sm:block">
          <SparklineChart data={player.ptrHistory} color={player.avatarColor} />
        </div>

        {/* PTR */}
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-base" style={{ color: player.avatarColor }}>
            {formatPTR(player.ptr)}
          </div>
          <PTRBadge delta={player.ptrDelta ?? 0} size="sm" />
        </div>
      </div>
    </Link>
  )
}
