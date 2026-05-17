import { formatDistanceToNow } from 'date-fns'
import { Zap } from 'lucide-react'
import PTRBadge from '@/components/shared/PTRBadge'
import { getInitials, getFullScore } from '@/lib/utils'
import type { MatchWithPlayers } from '@/types'

interface Props {
  match: MatchWithPlayers
}

export default function MatchCard({ match }: Props) {
  const teamA = [match.teamAPlayer1, match.teamAPlayer2]
  const teamB = [match.teamBPlayer1, match.teamBPlayer2]
  const aWon = match.winner === 'A'

  return (
    <div className="ptr-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-2">
          {match.isUpset && (
            <span className="text-[10px] bg-orange-400/20 text-orange-400 rounded px-1.5 py-0.5 font-medium flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" /> UPSET
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            Quality: {match.matchQuality.toFixed(1)}/10
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3">
        {/* Team A */}
        <div className={`flex-1 ${aWon ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {teamA.map(p => (
              <div
                key={p.id}
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-background"
                style={{ backgroundColor: p.avatarColor }}
                title={p.name}
              >
                {getInitials(p.name)}
              </div>
            ))}
            {aWon && <span className="text-[10px] text-neon-green font-semibold ml-1">WIN</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {teamA.map(p => p.name.split(' ')[0]).join(' & ')}
          </div>
        </div>

        {/* Score */}
        <div className="text-center">
          <div className="font-mono font-bold text-sm text-foreground">
            {getFullScore(match.sets)}
          </div>
          <PTRBadge delta={aWon ? match.ptrDelta : -match.ptrDelta} size="sm" />
        </div>

        {/* Team B */}
        <div className={`flex-1 text-right ${!aWon ? '' : 'opacity-60'}`}>
          <div className="flex items-center justify-end gap-1.5 mb-1">
            {!aWon && <span className="text-[10px] text-neon-green font-semibold mr-1">WIN</span>}
            {teamB.map(p => (
              <div
                key={p.id}
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-background"
                style={{ backgroundColor: p.avatarColor }}
                title={p.name}
              >
                {getInitials(p.name)}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            {teamB.map(p => p.name.split(' ')[0]).join(' & ')}
          </div>
        </div>
      </div>
    </div>
  )
}
