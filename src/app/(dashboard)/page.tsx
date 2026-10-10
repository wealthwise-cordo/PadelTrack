import Link from 'next/link'
import { Flame, TrendingUp, TrendingDown, Users, Plus } from 'lucide-react'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import { getCircleRankings } from '@/lib/store'
import { requireSession } from '@/lib/session'
import { getInitials } from '@/lib/utils'
import type { PlayerWithStats } from '@/types'

export const revalidate = 0

export default async function RankingsPage() {
  const session = await requireSession()
  const players = await getCircleRankings(session.player.id)
  const me = players.find(p => p.id === session.player.id)!
  const circleSize = players.length - 1

  const hottest = players.reduce((best, p) => (p.currentStreak > best.currentStreak ? p : best), players[0])
  const mover = players.reduce((best, p) => (Math.abs(p.ptrDelta ?? 0) > Math.abs(best.ptrDelta ?? 0) ? p : best), players[0])
  const moverDelta = mover.ptrDelta ?? 0

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Rankings</h1>
          <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-0.5">
            <Users className="h-3.5 w-3.5" />
            You and {circleSize} {circleSize === 1 ? 'player' : 'players'} you&apos;ve played
          </p>
        </div>
      </div>

      {/* Your position */}
      <div className="rounded-2xl bg-zinc-900 text-white p-5 flex items-center gap-4">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">Rank</div>
          <div className="text-3xl font-black text-orange-500">#{me.rank}</div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">Your rating</div>
          <div className="text-3xl font-black font-mono">{Math.round(me.ptr).toLocaleString()}</div>
        </div>
        <div className="text-right text-sm text-zinc-300">
          <div><span className="font-bold text-white">{me.wins}</span>W · <span className="font-bold text-white">{me.losses}</span>L</div>
          <div className="text-xs text-zinc-400">{me.matchesPlayed} {me.matchesPlayed === 1 ? 'match' : 'matches'}</div>
        </div>
      </div>

      {circleSize === 0 ? (
        <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-zinc-200">
          <Users className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
          <h2 className="font-bold">Your circle is empty</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            Record a ranked match and everyone you play with — partners and opponents — joins your rankings.
          </p>
          <Link href="/matches/new" className="inline-flex items-center gap-1.5 mt-5 px-4 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Record your first match
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Highlight
              label="Hottest streak"
              icon={<Flame className="h-3.5 w-3.5" />}
              tone="text-orange-600"
              player={hottest}
              value={hottest.currentStreak > 1 ? `${hottest.currentStreak} wins in a row` : hottest.currentStreak === 1 ? 'Won last match' : '—'}
            />
            <Highlight
              label="Biggest mover"
              icon={moverDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              tone={moverDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}
              player={mover}
              value={`${moverDelta > 0 ? '+' : ''}${moverDelta.toFixed(1)} last match`}
            />
          </div>
          <LeaderboardTable players={players} meId={me.id} />
        </>
      )}
    </div>
  )
}

function Highlight({ label, icon, tone, player, value }: { label: string; icon: React.ReactNode; tone: string; player: PlayerWithStats; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2 ${tone}`}>{icon} {label}</div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: player.avatarColor }}>
          {getInitials(player.name)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{player.name.split(' ')[0]}</div>
          <div className={`font-mono text-xs ${tone}`}>{value}</div>
        </div>
      </div>
    </div>
  )
}
