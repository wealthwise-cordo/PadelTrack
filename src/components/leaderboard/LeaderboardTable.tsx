'use client'

import PlayerRow from './PlayerRow'
import type { PlayerWithStats } from '@/types'

interface Props {
  players: PlayerWithStats[]
}

export default function LeaderboardTable({ players }: Props) {
  // Most in-form = highest currentStreak winner
  const mostInFormId = players.reduce((best, p) =>
    p.currentStreak > (best?.currentStreak ?? -Infinity) ? p : best
  , players[0])?.id

  return (
    <div className="flex flex-col gap-2">
      {players.map((player, i) => (
        <PlayerRow
          key={player.id}
          player={player}
          index={i}
          isMostInForm={player.id === mostInFormId && (player.currentStreak ?? 0) >= 2}
        />
      ))}
    </div>
  )
}
