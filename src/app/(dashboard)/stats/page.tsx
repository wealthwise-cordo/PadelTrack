import { prisma } from '@/lib/prisma'
import { Trophy, Zap, Target, TrendingUp, Flame } from 'lucide-react'
import { getInitials, formatPTR } from '@/lib/utils'

export const revalidate = 0

async function getStats() {
  const [players, matches] = await Promise.all([
    prisma.player.findMany({ orderBy: { ptr: 'desc' } }),
    prisma.match.findMany({
      include: {
        teamAPlayer1: true, teamAPlayer2: true,
        teamBPlayer1: true, teamBPlayer2: true,
        sets: true,
      },
      orderBy: { playedAt: 'desc' },
    }),
  ])

  const upsets = matches.filter(m => m.isUpset)
  const biggestUpset = upsets.reduce((best: typeof matches[0] | null, m) =>
    !best || m.ptrDelta > best.ptrDelta ? m : best
  , null)

  const highestDelta = matches.reduce((best: typeof matches[0] | null, m) =>
    !best || m.ptrDelta > best.ptrDelta ? m : best
  , null)

  const closestMatch = matches.reduce((best: typeof matches[0] | null, m) =>
    !best || m.matchQuality > best.matchQuality ? m : best
  , null)

  const bestStreak = players.reduce((best: typeof players[0] | null, p) =>
    !best || p.bestStreak > best.bestStreak ? p : best
  , null)

  return { players, matches, biggestUpset, highestDelta, closestMatch, bestStreak }
}

export default async function StatsPage() {
  const { players, matches, biggestUpset, highestDelta, closestMatch, bestStreak } = await getStats()

  const totalMatches = matches.length
  const totalUpsets = matches.filter(m => m.isUpset).length
  const avgQuality = matches.length > 0
    ? (matches.reduce((s, m) => s + m.matchQuality, 0) / matches.length).toFixed(1)
    : '—'

  return (
    <div className="py-6 space-y-5">
      <h1 className="text-2xl font-black tracking-tight">Tour Statistics</h1>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Matches', value: totalMatches },
          { label: 'Upsets', value: totalUpsets },
          { label: 'Avg Quality', value: avgQuality },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className="font-mono font-bold text-xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Awards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Awards</h2>

        {highestDelta && (
          <div className="glass rounded-xl p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Biggest PTR Swing</div>
              <div className="font-semibold text-sm">
                {highestDelta.teamAPlayer1.name.split(' ')[0]} & {highestDelta.teamAPlayer2.name.split(' ')[0]} vs {highestDelta.teamBPlayer1.name.split(' ')[0]} & {highestDelta.teamBPlayer2.name.split(' ')[0]}
              </div>
              <div className="text-neon-green font-mono font-bold">+{highestDelta.ptrDelta.toFixed(1)} PTR</div>
            </div>
          </div>
        )}

        {biggestUpset && (
          <div className="glass rounded-xl p-4 flex items-start gap-3">
            <Flame className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Biggest Upset</div>
              <div className="font-semibold text-sm">
                {biggestUpset.winner === 'A'
                  ? `${biggestUpset.teamAPlayer1.name.split(' ')[0]} & ${biggestUpset.teamAPlayer2.name.split(' ')[0]}`
                  : `${biggestUpset.teamBPlayer1.name.split(' ')[0]} & ${biggestUpset.teamBPlayer2.name.split(' ')[0]}`}
              </div>
              <div className="text-orange-400 text-xs">Won against the favourites · +{biggestUpset.ptrDelta.toFixed(1)} PTR swing</div>
            </div>
          </div>
        )}

        {closestMatch && (
          <div className="glass rounded-xl p-4 flex items-start gap-3">
            <Target className="h-5 w-5 text-neon-blue shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Match of the Tour</div>
              <div className="font-semibold text-sm">Quality: {closestMatch.matchQuality.toFixed(1)}/10</div>
              <div className="text-xs text-muted-foreground">
                {closestMatch.teamAPlayer1.name.split(' ')[0]} & {closestMatch.teamAPlayer2.name.split(' ')[0]} vs {closestMatch.teamBPlayer1.name.split(' ')[0]} & {closestMatch.teamBPlayer2.name.split(' ')[0]}
              </div>
            </div>
          </div>
        )}

        {bestStreak && bestStreak.bestStreak >= 2 && (
          <div className="glass rounded-xl p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-neon-green shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Longest Winning Streak</div>
              <div className="font-semibold text-sm">{bestStreak.name}</div>
              <div className="text-neon-green font-mono font-bold">{bestStreak.bestStreak} wins in a row</div>
            </div>
          </div>
        )}
      </div>

      {/* Power Rankings */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Power Rankings</h2>
        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={p.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="text-xs text-muted-foreground w-5 text-center font-mono">#{i + 1}</div>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-background shrink-0"
                style={{ backgroundColor: p.avatarColor }}
              >
                {getInitials(p.name)}
              </div>
              <div className="flex-1 text-sm font-medium">{p.name}</div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm" style={{ color: p.avatarColor }}>
                  {formatPTR(p.ptr)}
                </div>
                <div className="text-xs text-muted-foreground">{p.wins}W–{p.losses}L</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
