import { Trophy, TrendingUp } from 'lucide-react'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import { getPlayers, getMatchCount } from '@/lib/store'

export const revalidate = 0

export default async function LeaderboardPage() {
  const [players, totalMatches] = await Promise.all([getPlayers(), getMatchCount()])
  const topPlayer = players[0]
  const biggestMover = players.reduce((best, p) =>
    Math.abs(p.ptrDelta ?? 0) > Math.abs(best?.ptrDelta ?? 0) ? p : best
  , players[0])

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            Padel <span className="text-neon-green">Tour</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Spain 2026 · {totalMatches} matches played
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neon-green bg-neon-green/10 rounded-full px-3 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-neon-green animate-ptr-pulse" />
          Live
        </div>
      </div>

      {/* Highlight cards */}
      {players.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 mb-2">
              <Trophy className="h-3 w-3" /> Tour Leader
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background"
                style={{ backgroundColor: topPlayer.avatarColor }}
              >
                {topPlayer.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-semibold text-sm">{topPlayer.name.split(' ')[0]}</div>
                <div className="font-mono text-xs text-neon-green">{Math.round(topPlayer.ptr)} PTR</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-neon-blue mb-2">
              <TrendingUp className="h-3 w-3" /> Biggest Move
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background"
                style={{ backgroundColor: biggestMover.avatarColor }}
              >
                {biggestMover.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div>
                <div className="font-semibold text-sm">{biggestMover.name.split(' ')[0]}</div>
                <div className={`font-mono text-xs ${(biggestMover.ptrDelta ?? 0) >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                  {(biggestMover.ptrDelta ?? 0) > 0 ? '+' : ''}{(biggestMover.ptrDelta ?? 0).toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {players.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No players yet. Seed the database to get started.</p>
        </div>
      ) : (
        <LeaderboardTable players={players as any} />
      )}
    </div>
  )
}
