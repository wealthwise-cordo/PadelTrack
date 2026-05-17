import { getInitials } from '@/lib/utils'
import type { HeadToHead } from '@/types'

interface Props {
  data: HeadToHead[]
}

export default function HeadToHeadTable({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No head-to-head data yet.</p>
  }

  return (
    <div className="space-y-2">
      {data.map(opp => (
        <div key={opp.opponentId} className="flex items-center gap-3">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
            style={{ backgroundColor: opp.opponentColor }}
          >
            {getInitials(opp.opponentName)}
          </div>
          <div className="flex-1 text-sm">{opp.opponentName.split(' ')[0]}</div>
          <div className="font-mono text-sm">
            <span className="text-neon-green">{opp.wins}W</span>
            <span className="text-muted-foreground mx-1">–</span>
            <span className="text-red-400">{opp.losses}L</span>
          </div>
          <div className="text-xs text-muted-foreground w-10 text-right">{opp.winRate}%</div>
        </div>
      ))}
    </div>
  )
}
