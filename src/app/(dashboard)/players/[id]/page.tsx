import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayer, getPlayerRaw, getMatchesForPlayer, getCircleRankings, canEditPlayer, getAccount } from '@/lib/store'
import { requireSession } from '@/lib/session'
import ProfileStats from '@/components/players/ProfileStats'
import PTRBadge from '@/components/shared/PTRBadge'
import PlayerEditPanel from '@/components/players/PlayerEditPanel'
import CompleteProfileCard from '@/components/players/CompleteProfileCard'
import InviteLink from '@/components/players/InviteLink'
import MatchCard from '@/components/matches/MatchCard'
import { getInitials, formatRating, getWinRate, formatRatingDelta, setWinner } from '@/lib/utils'
import { Trophy, Swords, Handshake, ChevronRight, Info } from 'lucide-react'
import type { MatchWithPlayers, ProfileMatch } from '@/types'
import { currentReliability } from '@/lib/ptr-algorithm'
import { getRole, canAdjustRatings } from '@/lib/roles'
import { getPlayerAdjustments } from '@/lib/rating-adjustments'
import AdjustRatingPanel from '@/components/players/AdjustRatingPanel'
import { levelDelta } from '@/lib/lta'

export const revalidate = 0

function headToHead(matches: MatchWithPlayers[], playerId: string) {
  const h2h: Record<string, { wins: number; losses: number; name: string; color: string }> = {}
  for (const m of matches) {
    // Incomplete matches have no result, so they don't count head-to-head.
    if (m.status !== 'complete' || !m.isRanked || m.incomplete) continue
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

// This player's confirmed ranked matches from their side of the net, oldest
// first. Incomplete ones are included (flagged) for their set and game stats.
function toProfileMatches(matches: MatchWithPlayers[], playerId: string): ProfileMatch[] {
  return matches
    .filter(m => m.status === 'complete' && m.isRanked)
    .map(m => {
      const onA = m.teamAPlayer1Id === playerId || m.teamAPlayer2Id === playerId
      const played = m.sets.filter(s => s.teamAGames + s.teamBGames > 0)
      // Only finished sets count; an incomplete match's last set may be part-played.
      const setsA = played.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'A').length
      const setsB = played.filter(s => setWinner(s.teamAGames, s.teamBGames) === 'B').length
      const gamesA = played.reduce((n, s) => n + s.teamAGames, 0)
      const gamesB = played.reduce((n, s) => n + s.teamBGames, 0)
      const opps = onA ? [m.teamBPlayer1, m.teamBPlayer2] : [m.teamAPlayer1, m.teamAPlayer2]
      return {
        id: m.id,
        playedAt: m.playedAt,
        won: m.winner === (onA ? 'A' : 'B'),
        incomplete: m.incomplete,
        setsFor: onA ? setsA : setsB,
        setsAgainst: onA ? setsB : setsA,
        gamesFor: onA ? gamesA : gamesB,
        gamesAgainst: onA ? gamesB : gamesA,
        delta: m.viewerDelta ?? 0,
        opponents: opps.map(p => p.name.split(' ')[0]).join(' & '),
      }
    })
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
}

// The viewer's record against, and alongside, this player.
function versusMe(matches: MatchWithPlayers[], meId: string, themId: string) {
  let against = { wins: 0, losses: 0 }
  let together = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (m.status !== 'complete' || !m.isRanked || m.incomplete) continue
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
  const [player, raw, matches, circle, account, role, adjustments] = await Promise.all([
    getPlayer(params.id),
    getPlayerRaw(params.id),
    getMatchesForPlayer(params.id),
    getCircleRankings(session.player.id),
    params.id === session.player.id ? getAccount(session.userId) : null,
    getRole(session.userId),
    getPlayerAdjustments(params.id),
  ])
  if (!player || !raw || raw.deletedAt) notFound()

  const isMe = player.id === session.player.id
  const canEdit = canEditPlayer(raw, session.userId)
  // Levellers can't adjust a super user (nobody could review it).
  const canAdjust = canAdjustRatings(role) && !isMe && !player.isGuest &&
    (role === 'superuser' || !raw.userId || (await getRole(raw.userId)) !== 'superuser')
  // The player sees that their rating was adjusted; only levellers and the
  // super user see why.
  const showAdjustments = adjustments.applied.length > 0 && (isMe || canAdjustRatings(role))
  const showReasons = canAdjustRatings(role)
  const rank = circle.find(p => p.id === player.id)?.rank
  const lastDelta = player.ptrDelta ?? 0
  // Of matches with a result: incomplete ones count as played but have none.
  const winRate = getWinRate(player.wins, player.wins + player.losses)
  const h2h = headToHead(matches, player.id)
  const vs = isMe ? null : versusMe(matches, session.player.id, player.id)
  // Their latest confirmed matches. On someone else's profile the rating
  // change shown would be theirs, not yours, so it's left off.
  // Reliability today (includes any decay since their last ranked match).
  const reliability = currentReliability(raw.reliability, raw.lastRankedPlayedAt)

  const recent = matches
    .filter(m => m.status === 'complete' && m.isRanked)
    .slice(0, 5)
    .map(m => (isMe ? m : { ...m, viewerDelta: undefined }))

  return (
    <div className="py-6 space-y-5">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0" style={{ backgroundColor: player.avatarColor }}>
            {getInitials(player.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-black truncate">{player.name}</h1>
              {player.isGuest && <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">Guest</span>}
              {isMe && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 shrink-0">YOU</span>}
            </div>
            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
              {player.nickname && <span>&ldquo;{player.nickname}&rdquo;</span>}
              {rank && <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-orange-500" /> #{rank} in your circle</span>}
              <span>{player.wins}W–{player.losses}L</span>
              <span>{winRate}% wins</span>
              {!player.isGuest && (
                <span className="inline-flex items-center gap-1">
                  Reliability {Math.round(reliability * 100)}%
                  <details className="inline-block">
                    <summary className="list-none cursor-pointer text-zinc-400 hover:text-zinc-700" aria-label="What is reliability?">
                      <Info className="h-3.5 w-3.5" />
                    </summary>
                    <span className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg bg-zinc-900 text-white text-[11px] leading-snug p-2 shadow-lg">
                      How settled this rating is. It starts low, so early matches move your rating more, and it builds with every ranked match you play.
                    </span>
                  </details>
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            {player.isGuest ? (
              <div className="text-xs font-semibold text-zinc-400 leading-tight">Unrated</div>
            ) : (
              <>
                <div className="font-mono font-black text-xl text-zinc-900 leading-tight">{formatRating(player.ptr)}</div>
                <PTRBadge delta={lastDelta} size="sm" />
              </>
            )}
          </div>
        </div>
        {canAdjust && (
          <div className="mt-3">
            <AdjustRatingPanel
              playerId={player.id}
              firstName={player.name.split(' ')[0]}
              ptr={player.ptr}
              isSuperUser={role === 'superuser'}
              coolingOffUntil={adjustments.coolingOffUntil}
              pending={adjustments.pending && {
                levels: levelDelta(adjustments.pending.delta),
                reason: adjustments.pending.reason,
                requestedBy: adjustments.pending.requestedBy?.name ?? null,
              }}
            />
          </div>
        )}
        {canEdit && (
          <div className="mt-3">
            <PlayerEditPanel playerId={player.id} name={player.name} nickname={player.nickname} avatarColor={player.avatarColor} account={isMe ? account : null} />
          </div>
        )}
      </div>

      {isMe && account?.profileIncomplete && <CompleteProfileCard />}

      {player.isGuest && canEdit && raw.claimToken && <InviteLink token={raw.claimToken} name={player.name} />}

      {vs && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: `You vs ${player.name.split(' ')[0]}`, icon: Swords, record: vs.against, view: 'against' },
            { label: 'As partners', icon: Handshake, record: vs.together, view: 'partners' },
          ].map(({ label, icon: Icon, record, view }) => (
            <Link key={label} href={`/players/${player.id}/vs?view=${view}`} className="group rounded-xl bg-zinc-900 text-white p-4 hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                <Icon className="h-3.5 w-3.5 text-orange-500" /> <span className="flex-1">{label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
              <div className="font-mono font-black text-2xl">
                <span className="text-orange-500">{record.wins}W</span>
                <span className="text-zinc-500 mx-1.5">–</span>
                {record.losses}L
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProfileStats matches={toProfileMatches(matches, player.id)} currentRating={player.ptr} adjustments={adjustments.applied} />

      {showAdjustments && (
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">Rating adjustments</h2>
          <ul className="space-y-2">
            {[...adjustments.applied].reverse().map(a => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className={`font-mono font-semibold w-14 shrink-0 ${a.delta > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatRatingDelta(a.delta)}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-zinc-800">{showReasons ? a.reason : 'Adjusted by a leveller'}</span>
                  <span className="block text-[11px] text-zinc-400">{new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{isMe ? 'Your recent ranked matches' : `${player.name.split(' ')[0]}’s recent ranked matches`}</h2>
          {recent.map(m => <MatchCard key={m.id} match={m} canDelete={isMe} />)}
        </section>
      )}

      {h2h.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center justify-between">Head-to-head <span className="text-[11px] font-medium text-zinc-400">All time</span></h2>
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
