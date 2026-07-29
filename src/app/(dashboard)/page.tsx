import { Flame, TrendingUp, TrendingDown } from 'lucide-react'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import LiveRefreshButton from '@/components/leaderboard/LiveRefreshButton'
import { getPlayers, getMatchCount } from '@/lib/store'

export const revalidate = 0

export default async function LeaderboardPage() {
  const [players, totalMatches] = await Promise.all([getPlayers(), getMatchCount()])

  const hottestStreak = players.reduce((best, p) =>
    (p.currentStreak > 0 ? p.currentStreak : 0) > (best.currentStreak > 0 ? best.currentStreak : 0) ? p : best
  , players[0])

  const biggestMover = players.reduce((best, p) =>
    Math.abs(p.ptrDelta ?? 0) > Math.abs(best?.ptrDelta ?? 0) ? p : best
  , players[0])

  const moverDelta = biggestMover?.ptrDelta ?? 0

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
        <LiveRefreshButton />
      </div>

      {/* Highlight cards */}
      {players.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-orange-400 mb-2">
              <Flame className="h-3 w-3" /> Hottest Streak
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-background"
                style={{ backgroundColor: hottestStreak.avatarColor }}
              >
                {hottestStreak.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-semibold text-sm">{hottestStreak.name.split(' ')[0]}</div>
                <div className="font-mono text-xs text-orange-400">
                  {hottestStreak.currentStreak > 0 ? `${hottestStreak.currentStreak}W streak` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className={`flex items-center gap-1.5 text-[10px] mb-2 ${moverDelta >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
              {moverDelta >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />
              } Biggest Mover
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
                <div className={`font-mono text-xs ${moverDelta >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                  {moverDelta > 0 ? '+' : ''}{moverDelta.toFixed(1)}
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
