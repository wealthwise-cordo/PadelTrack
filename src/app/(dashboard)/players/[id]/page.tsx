import { notFound } from 'next/navigation'
import { getPlayer, getPlayerRaw, getMatchesForPlayer, getCircleRankings, canEditPlayer } from '@/lib/store'
import { requireSession } from '@/lib/session'
import PTRLineChart from '@/components/players/PTRLineChart'
import PTRBadge from '@/components/shared/PTRBadge'
import PlayerEditPanel from '@/components/players/PlayerEditPanel'
import InviteLink from '@/components/players/InviteLink'
import { getInitials, formatPTR, getWinRate } from '@/lib/utils'
import { Trophy, Target, Zap, TrendingUp, Swords, Handshake } from 'lucide-react'
import type { MatchWithPlayers } from '@/types'

export const revalidate = 0

function headToHead(matches: MatchWithPlayers[], playerId: string) {
  const h2h: Record<string, { wins: number; losses: number; name: string; color: string }> = {}
  for (const m of matches) {
    if (m.status !== 'complete') continue
    const onTeamA = m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId
    const opponents = onTeamA ? [m.teamBPlayer1, m.teamBPlayer2] : [m.teamAPlayer1, m.teamAPlayer2]
    const won = (onTeamA && m.winner === 'A') || (!onTeamA && m.winner === 'B')
    for (const opp of opponents) {
      if (!h2h[opp.id]) h2h[opp.id] = { wins: 0, losses: 0, name: opp.name, color: opp.avatarColor }
      if (won) h2h[opp.id].wins++
      else h2h[opp.id].losses++
    }
  }
  return Object.entries(h2h)
    .map(([id, v]) => ({ id, ...v, winRate: getWinRate(v.wins, v.wins + v.losses) }))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
}

// The viewer's record against, and alongside, this player.
function versusMe(matches: MatchWithPlayers[], meId: string, themId: string) {
  let against = { wins: 0, losses: 0 }
  let together = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (m.status !== 'complete') continue
    const a = [m.teamAPlayer1Id, m.teamAPlayer2Id]
    const b = [m.teamBPlayer1Id, m.teamBPlayer2Id]
    const meSide = a.includes(meId) ? 'A' : b.includes(meId) ? 'B' : null
    const themSide = a.includes(themId) ? 'A' : b.includes(themId) ? 'B' : null
    if (!meSide || !themSide) continue
    const iWon = m.winner === meSide
    const bucket = meSide === themSide ? together : against
    if (iWon) bucket.wins++
    else bucket.losses++
  }
  return { against, together }
}

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const session = await requireSession()
  const [player, raw, matches, circle] = await Promise.all([
    getPlayer(params.id),
    getPlayerRaw(params.id),
    getMatchesForPlayer(params.id),
    getCircleRankings(session.player.id),
  ])
  if (!player || !raw) notFound()

  const isMe = player.id === session.player.id
  const canEdit = canEditPlayer(raw, session.userId)
  const rank = circle.find(p => p.id === player.id)?.rank
  const lastDelta = player.ptrHistory.length > 0 ? player.ptrHistory[player.ptrHistory.length - 1].delta : 0
  const winRate = getWinRate(player.wins, player.matchesPlayed)
  const avgGainPerWin = player.wins > 0
    ? player.ptrHistory.filter(h => h.delta > 0).reduce((s, h) => s + h.delta, 0) / player.wins
    : 0
  const avgLossPerLoss = player.losses > 0
    ? Math.abs(player.ptrHistory.filter(h => h.delta < 0).reduce((s, h) => s + h.delta, 0) / player.losses)
    : 0
  const h2h = headToHead(matches, player.id)
  const vs = isMe ? null : versusMe(matches, session.player.id, player.id)

  return (
    <div className="py-6 space-y-5">
      <div className="glass rounded-2xl p-5 flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ backgroundColor: player.avatarColor }}>
          {getInitials(player.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-black truncate">{player.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {player.nickname && <span className="text-sm text-zinc-500">&ldquo;{player.nickname}&rdquo;</span>}
                {player.isGuest && <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5">Guest</span>}
                {isMe && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 rounded px-1.5 py-0.5">YOU</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-black text-2xl text-zinc-900">{formatPTR(player.ptr)}</div>
              <PTRBadge delta={lastDelta} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            {rank && <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-orange-500" /> #{rank} in your circle</span>}
            <span>{player.wins}W–{player.losses}L</span>
            <span>{winRate}% wins</span>
          </div>
          {canEdit && (
            <div className="mt-3">
              <PlayerEditPanel playerId={player.id} name={player.name} nickname={player.nickname} avatarColor={player.avatarColor} />
            </div>
          )}
        </div>
      </div>

      {player.isGuest && canEdit && raw.claimToken && <InviteLink token={raw.claimToken} name={player.name} />}

      {vs && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-900 text-white p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
              <Swords className="h-3.5 w-3.5 text-orange-500" /> You vs {player.name.split(' ')[0]}
            </div>
            <div className="font-mono font-black text-2xl">
              <span className="text-orange-500">{vs.against.wins}</span>
              <span className="text-zinc-500 mx-1">–</span>
              {vs.against.losses}
            </div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
              <Handshake className="h-3.5 w-3.5" /> As partners
            </div>
            <div className="font-mono font-black text-2xl">
              {vs.together.wins}<span className="text-zinc-400 mx-1">–</span>{vs.together.losses}
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          Rating history
        </h2>
        <PTRLineChart history={player.ptrHistory} color="#f97316" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Win rate', value: `${winRate}%`, icon: Target },
          { label: 'Best streak', value: `${player.bestStreak}W`, icon: Zap },
          { label: 'Avg gain / win', value: `+${avgGainPerWin.toFixed(1)}`, icon: TrendingUp },
          { label: 'Avg loss / defeat', value: `-${avgLossPerLoss.toFixed(1)}`, icon: Trophy },
          { label: 'Sets', value: `${player.setsWon}–${player.setsLost}`, icon: Target },
          { label: 'Games', value: `${player.gamesWon}–${player.gamesLost}`, icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
              <Icon className="h-3 w-3" /> {label}
            </div>
            <div className="font-mono font-bold text-lg">{value}</div>
          </div>
        ))}
      </div>

      {h2h.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Head-to-head</h2>
          <div className="space-y-2">
            {h2h.map(opp => (
              <div key={opp.id} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: opp.color }}>
                  {getInitials(opp.name)}
                </div>
                <div className="flex-1 text-sm truncate">{opp.id === session.player.id ? 'You' : opp.name}</div>
                <div className="font-mono text-sm">
                  <span className="text-emerald-700">{opp.wins}W</span>
                  <span className="text-zinc-400 mx-1">–</span>
                  <span className="text-red-600">{opp.losses}L</span>
                </div>
                <div className="text-xs text-zinc-500 w-10 text-right">{opp.winRate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
