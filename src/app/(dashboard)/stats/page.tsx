import { getPlayers, getMatches } from '@/lib/store'
import { Trophy, Zap, Target, TrendingUp, Heart } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import StatLeaderboard from '@/components/stats/StatLeaderboard'
import type { PlayerWithStats } from '@/types'

export const revalidate = 0

// ─── Sorting helpers ────────────────────────────────────────────────────────

function rank(
  players: PlayerWithStats[],
  primary: (p: PlayerWithStats) => number,
  ...tiebreakers: ((p: PlayerWithStats) => number)[]
) {
  return [...players].sort((a, b) => {
    const d = primary(b) - primary(a)
    if (d !== 0) return d
    for (const tb of tiebreakers) {
      const t = tb(b) - tb(a)
      if (t !== 0) return t
    }
    return 0
  })
}

// ─── Choker score ────────────────────────────────────────────────────────────
// Measures how much more often a player wins games than they win sets.
// Positive = winning games but not converting them into set wins.

function chokerScore(p: PlayerWithStats): number {
  const totalGames = p.gamesWon + p.gamesLost
  const totalSets = p.setsWon + p.setsLost
  if (totalGames < 10 || totalSets === 0) return -1
  return (p.gamesWon / totalGames) - (p.setsWon / totalSets)
}

function tiebreakConversion(p: PlayerWithStats): number {
  return p.tiebreaksPlayed > 0 ? p.tiebreaksWon / p.tiebreaksPlayed : 0
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StatsPage() {
  const [players, matches] = await Promise.all([getPlayers(), getMatches()])

  const totalMatches = matches.length
  const totalUpsets = matches.filter(m => m.isUpset).length
  const avgQuality = matches.length > 0
    ? (matches.reduce((s, m) => s + m.matchQuality, 0) / matches.length).toFixed(1)
    : '—'

  // ── Award winners ──────────────────────────────────────────────────────────

  const bigWinner = rank(players,
    p => p.wins,
    p => p.setsWon,
  )[0]

  const thanksForPlaying = rank(players,
    p => p.matchesPlayed,
    p => p.setsWon + p.setsLost,
    p => p.gamesWon + p.gamesLost,
  )[0]

  const chokers = rank(players, chokerScore)
  const choker = chokers[0]?.matchesPlayed >= 1 && chokerScore(chokers[0]) > 0
    ? chokers[0]
    : null

  const tiebreakKing = rank(players,
    p => p.tiebreaksWon,
    tiebreakConversion,
  )[0]
  const hasTiebreaks = players.some(p => p.tiebreaksWon > 0)

  // ── Leaderboard entries ────────────────────────────────────────────────────

  const matchesWon    = rank(players, p => p.wins, p => p.setsWon)
  const setsWon       = rank(players, p => p.setsWon, p => p.gamesWon)
  const gamesWon      = rank(players, p => p.gamesWon, p => p.setsWon)
  const tiebreaksWon  = rank(players, p => p.tiebreaksWon, tiebreakConversion)
  const matchesPlayed = rank(players,
    p => p.matchesPlayed,
    p => p.setsWon + p.setsLost,
    p => p.gamesWon + p.gamesLost,
  )

  return (
    <div className="py-6 space-y-6">
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
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Awards</h2>

        {totalMatches === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matches yet.</p>
        )}

        {bigWinner && bigWinner.wins > 0 && (
          <AwardCard
            icon={<Trophy className="h-5 w-5 text-yellow-400" />}
            title="Big Winner"
            player={bigWinner}
            stat={`${bigWinner.wins}W`}
            sub={`${bigWinner.setsWon} sets won`}
          />
        )}

        {thanksForPlaying && thanksForPlaying.matchesPlayed > 0 && (
          <AwardCard
            icon={<Heart className="h-5 w-5 text-pink-400" />}
            title="Thanks for Playing"
            player={thanksForPlaying}
            stat={`${thanksForPlaying.matchesPlayed} matches`}
            sub={`${thanksForPlaying.setsWon + thanksForPlaying.setsLost} sets · ${thanksForPlaying.gamesWon + thanksForPlaying.gamesLost} games played`}
          />
        )}

        {choker && (
          <AwardCard
            icon={<Target className="h-5 w-5 text-orange-400" />}
            title="Choker"
            player={choker}
            stat={`${Math.round((p => (p.gamesWon / (p.gamesWon + p.gamesLost)) * 100)(choker))}% game win rate`}
            sub={`Only ${Math.round((p => (p.setsWon / (p.setsWon + p.setsLost)) * 100)(choker))}% set win rate`}
          />
        )}

        {hasTiebreaks && tiebreakKing && (
          <AwardCard
            icon={<Zap className="h-5 w-5 text-neon-blue" />}
            title="Tiebreak King"
            player={tiebreakKing}
            stat={`${tiebreakKing.tiebreaksWon} tiebreaks`}
            sub={tiebreakKing.tiebreaksPlayed > 0
              ? `${Math.round(tiebreakConversion(tiebreakKing) * 100)}% win rate in tiebreaks`
              : ''}
          />
        )}
      </div>

      {/* Stat leaderboards */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rankings</h2>

        <StatLeaderboard
          title="Matches Won"
          entries={matchesWon.map(p => ({
            player: p,
            value: p.wins,
            display: String(p.wins),
            sub: `${p.setsWon} sets · ${p.gamesWon} games won`,
          }))}
        />
        <StatLeaderboard
          title="Matches Played"
          entries={matchesPlayed.map(p => ({
            player: p,
            value: p.matchesPlayed,
            display: String(p.matchesPlayed),
            sub: `${p.setsWon + p.setsLost} sets · ${p.gamesWon + p.gamesLost} games`,
          }))}
        />
        <StatLeaderboard
          title="Tiebreaks Won"
          entries={tiebreaksWon.map(p => ({
            player: p,
            value: p.tiebreaksWon,
            display: p.tiebreaksPlayed > 0 ? `${p.tiebreaksWon}/${p.tiebreaksPlayed}` : '0',
            sub: p.tiebreaksPlayed > 0 ? `${Math.round(tiebreakConversion(p) * 100)}% conversion` : undefined,
          }))}
        />
      </div>
    </div>
  )
}

// ─── Award card ───────────────────────────────────────────────────────────────

function AwardCard({
  icon, title, player, stat, sub,
}: {
  icon: React.ReactNode
  title: string
  player: PlayerWithStats
  stat: string
  sub: string
}) {
  return (
    <div className="glass rounded-xl p-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">{title}</div>
        <div className="flex items-center gap-2 mb-0.5">
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background shrink-0"
            style={{ backgroundColor: player.avatarColor }}
          >
            {getInitials(player.name)}
          </div>
          <span className="font-semibold text-sm truncate">{player.name}</span>
        </div>
        <div className="font-mono font-bold text-neon-green text-sm">{stat}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}
