import { notFound } from 'next/navigation'
import { getPlayer, getPlayers, getMatches } from '@/lib/store'
import PTRLineChart from '@/components/players/PTRLineChart'
import PTRBadge from '@/components/shared/PTRBadge'
import { getInitials, formatPTR, getWinRate, getReliabilityLabel } from '@/lib/utils'
import { Trophy, Target, Zap, TrendingUp } from 'lucide-react'

export const revalidate = 0

function getHeadToHead(playerId: string) {
  const matches = getMatches().filter(m =>
    [m.teamAPlayer1Id, m.teamAPlayer2Id, m.teamBPlayer1Id, m.teamBPlayer2Id].includes(playerId)
  )

  const h2h: Record<string, { wins: number; losses: number; name: string; color: string }> = {}

  for (const m of matches) {
    const onTeamA = m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId
    const opponents = onTeamA ? [m.teamBPlayer1, m.teamBPlayer2] : [m.teamAPlayer1, m.teamAPlayer2]
    const won = (onTeamA && m.winner === 'A') || (!onTeamA && m.winner === 'B')

    for (const opp of opponents) {
      if (!h2h[opp.id]) h2h[opp.id] = { wins: 0, losses: 0, name: opp.name, color: opp.avatarColor }
      if (won) h2h[opp.id].wins++
      else h2h[opp.id].losses++
    }
  }

  return Object.entries(h2h).map(([id, v]) => ({
    opponentId: id,
    opponentName: v.name,
    opponentColor: v.color,
    wins: v.wins,
    losses: v.losses,
    winRate: getWinRate(v.wins, v.wins + v.losses),
  }))
}

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const player = getPlayer(params.id)
  const allPlayers = getPlayers()
  const h2h = getHeadToHead(params.id)

  if (!player) notFound()

  if (!player) notFound()

  const rank = allPlayers.findIndex(p => p.id === player.id) + 1
  const lastDelta = player.ptrHistory.length > 0
    ? player.ptrHistory[player.ptrHistory.length - 1].delta
    : 0

  const winRate = getWinRate(player.wins, player.matchesPlayed)
  const avgGainPerWin = player.wins > 0
    ? player.ptrHistory.filter(h => h.delta > 0).reduce((s, h) => s + h.delta, 0) / player.wins
    : 0
  const avgLossPerLoss = player.losses > 0
    ? Math.abs(player.ptrHistory.filter(h => h.delta < 0).reduce((s, h) => s + h.delta, 0) / player.losses)
    : 0

  return (
    <div className="py-6 space-y-5">
      {/* Profile Header */}
      <div className="glass rounded-2xl p-5 flex items-start gap-4">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-background shrink-0"
          style={{ backgroundColor: player.avatarColor }}
        >
          {getInitials(player.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-black">{player.name}</h1>
              {player.nickname && (
                <p className="text-sm text-muted-foreground">"{player.nickname}"</p>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono font-black text-2xl" style={{ color: player.avatarColor }}>
                {formatPTR(player.ptr)}
              </div>
              <PTRBadge delta={lastDelta} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" /> #{rank}
            </span>
            <span>{player.wins}W–{player.losses}L</span>
            <span>{winRate}% wins</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/5">
              {getReliabilityLabel(player.reliability)}
            </span>
          </div>
        </div>
      </div>

      {/* PTR Chart */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-neon-green" />
          PTR History
        </h2>
        <PTRLineChart
          history={player.ptrHistory}
          color={player.avatarColor}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Win Rate', value: `${winRate}%`, icon: Target },
          { label: 'Best Streak', value: `${player.bestStreak}W`, icon: Zap },
          { label: 'Avg Gain / Win', value: `+${avgGainPerWin.toFixed(1)}`, icon: TrendingUp },
          { label: 'Avg Loss / Defeat', value: `-${avgLossPerLoss.toFixed(1)}`, icon: Trophy },
          { label: 'Sets Won', value: `${player.setsWon}–${player.setsLost}`, icon: Target },
          { label: 'Games Won', value: `${player.gamesWon}–${player.gamesLost}`, icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Icon className="h-3 w-3" /> {label}
            </div>
            <div className="font-mono font-bold text-lg">{value}</div>
          </div>
        ))}
      </div>

      {/* Head to Head */}
      {h2h.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Head-to-Head</h2>
          <div className="space-y-2">
            {h2h.map(opp => (
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
        </div>
      )}
    </div>
  )
}
