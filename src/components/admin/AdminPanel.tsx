'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Lock, AlertTriangle, CheckCircle2, Plus, X, History, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getInitials, getFullScore } from '@/lib/utils'
import type { MatchWithPlayers, PlayerWithStats } from '@/types'
import type { AmericanoEventSummary } from '@/lib/americano-store'
import type { RoundRobinEventSummary } from '@/lib/round-robin-store'
import type { OnePointEventSummary } from '@/lib/one-point-store'
import type { SnakeLaddersEventSummary } from '@/lib/snake-ladders-store'
import type { Season, Player } from '@prisma/client'

const PASSCODE = '5299'

interface Props {
  activeSeason: Season | null
  seasons: Season[]
  allPlayers: Player[]
  lastSeasonPlayerIds: string[]
  matches: MatchWithPlayers[]
  americanoEvents: AmericanoEventSummary[]
  roundRobinEvents: RoundRobinEventSummary[]
  onePointEvents: OnePointEventSummary[]
  snakeLaddersEvents: SnakeLaddersEventSummary[]
  players: PlayerWithStats[]
}

export default function AdminPanel({
  activeSeason, seasons, allPlayers, lastSeasonPlayerIds,
  matches, americanoEvents, roundRobinEvents, onePointEvents, snakeLaddersEvents, players,
}: Props) {
  const router = useRouter()
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [eventDeleteError, setEventDeleteError] = useState('')
  const [deletingRRId, setDeletingRRId] = useState<string | null>(null)
  const [rrDeleteError, setRRDeleteError] = useState('')
  const [deletingOPId, setDeletingOPId] = useState<string | null>(null)
  const [opDeleteError, setOPDeleteError] = useState('')
  const [deletingSLId, setDeletingSLId] = useState<string | null>(null)
  const [slDeleteError, setSLDeleteError] = useState('')

  // Season lifecycle state
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [reopeningId, setReopeningId] = useState<string | null>(null)
  const [reopenError, setReopenError] = useState('')
  const [seasonName, setSeasonName] = useState('')
  const [seasonLocation, setSeasonLocation] = useState('')
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null)
  const [carryOverIds, setCarryOverIds] = useState<Set<string>>(new Set(lastSeasonPlayerIds))
  const [newPlayerDrafts, setNewPlayerDrafts] = useState<{ name: string; nickname: string }[]>([])
  const [draftName, setDraftName] = useState('')
  const [draftNickname, setDraftNickname] = useState('')
  const [startingSeason, setStartingSeason] = useState(false)
  const [startError, setStartError] = useState('')

  const byId = new Map(players.map(p => [p.id, p]))
  const closedSeasons = seasons.filter(s => s.status === 'closed')

  const handleUnlock = () => {
    if (code === PASSCODE) {
      setUnlocked(true)
      setCodeError(false)
    } else {
      setCodeError(true)
      setCode('')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError('')
    try {
      const res = await fetch(`/api/admin/matches/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setDeleteError('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    setDeletingEventId(id)
    setEventDeleteError('')
    try {
      const res = await fetch(`/api/admin/events/americano/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setEventDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setEventDeleteError('Network error')
    } finally {
      setDeletingEventId(null)
    }
  }

  const handleDeleteRR = async (id: string) => {
    setDeletingRRId(id)
    setRRDeleteError('')
    try {
      const res = await fetch(`/api/admin/events/round-robin/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setRRDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setRRDeleteError('Network error')
    } finally {
      setDeletingRRId(null)
    }
  }

  const handleDeleteOP = async (id: string) => {
    setDeletingOPId(id)
    setOPDeleteError('')
    try {
      const res = await fetch(`/api/admin/events/one-point/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setOPDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setOPDeleteError('Network error')
    } finally {
      setDeletingOPId(null)
    }
  }

  const handleDeleteSL = async (id: string) => {
    setDeletingSLId(id)
    setSLDeleteError('')
    try {
      const res = await fetch(`/api/admin/events/snake-ladders/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setSLDeleteError(d.error || 'Delete failed')
      } else {
        router.refresh()
      }
    } catch {
      setSLDeleteError('Network error')
    } finally {
      setDeletingSLId(null)
    }
  }

  const handleCloseSeason = async () => {
    if (!activeSeason) return
    setClosing(true)
    setCloseError('')
    try {
      const res = await fetch(`/api/seasons/${activeSeason.id}/close`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setCloseError(d.error || 'Failed to close season')
      } else {
        setConfirmingClose(false)
        router.refresh()
      }
    } catch {
      setCloseError('Network error')
    } finally {
      setClosing(false)
    }
  }

  const handleDeleteSeason = async (id: string) => {
    setDeletingSeasonId(id)
    setReopenError('')
    try {
      const res = await fetch(`/api/seasons/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setReopenError(d.error || 'Failed to delete season')
      } else {
        setConfirmDeleteSeason(null)
        setDeleteConfirmText('')
        router.refresh()
      }
    } catch {
      setReopenError('Network error')
    } finally {
      setDeletingSeasonId(null)
    }
  }

  const handleReopen = async (id: string) => {
    setReopeningId(id)
    setReopenError('')
    try {
      const res = await fetch(`/api/seasons/${id}/reopen`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setReopenError(d.error || 'Failed to reopen season')
      } else {
        router.refresh()
      }
    } catch {
      setReopenError('Network error')
    } finally {
      setReopeningId(null)
    }
  }

  const toggleCarryOver = (id: string) => {
    setCarryOverIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addDraftPlayer = () => {
    if (!draftName.trim()) return
    setNewPlayerDrafts(prev => [...prev, { name: draftName.trim(), nickname: draftNickname.trim() }])
    setDraftName('')
    setDraftNickname('')
  }

  const removeDraftPlayer = (i: number) => {
    setNewPlayerDrafts(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleStartSeason = async () => {
    setStartingSeason(true)
    setStartError('')
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: seasonName,
          location: seasonLocation,
          carryOverPlayerIds: Array.from(carryOverIds),
          newPlayers: newPlayerDrafts.map(d => ({ name: d.name, nickname: d.nickname || undefined })),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setStartError(d.error || 'Failed to start season')
      } else {
        setSeasonName('')
        setSeasonLocation('')
        setNewPlayerDrafts([])
        router.refresh()
      }
    } catch {
      setStartError('Network error')
    } finally {
      setStartingSeason(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-5 w-5" />
          <span className="text-sm font-medium">Admin Access</span>
        </div>
        <div className="glass rounded-2xl p-6 w-full max-w-xs space-y-4">
          <input
            type="password"
            inputMode="numeric"
            placeholder="Enter passcode"
            value={code}
            onChange={e => { setCode(e.target.value); setCodeError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-center font-mono text-xl tracking-widest focus:outline-none transition-colors ${
              codeError ? 'border-red-400/50 text-red-400' : 'border-white/10 focus:border-neon-green/50'
            }`}
          />
          {codeError && <p className="text-xs text-red-400 text-center">Incorrect passcode</p>}
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 transition-all"
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>

      {/* Season */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Season</h2>

        {activeSeason ? (
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neon-green shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{activeSeason.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Active since {formatDistanceToNow(new Date(activeSeason.startedAt), { addSuffix: true })}
                </div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-green/15 text-neon-green font-bold uppercase tracking-wide shrink-0">
                Active
              </span>
            </div>

            {closeError && <p className="text-xs text-red-400 text-center">{closeError}</p>}

            {!confirmingClose ? (
              <button
                onClick={() => setConfirmingClose(true)}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 border border-red-400/20 hover:bg-red-500/20 transition-all"
              >
                Close Season
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-red-400/20 p-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                  Freezes every match and event in {activeSeason.name}. Nothing more can be recorded against it
                  until an admin reopens it.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirmingClose(false)}
                    className="py-2 rounded-xl font-bold text-xs bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloseSeason}
                    disabled={closing}
                    className="py-2 rounded-xl font-bold text-xs bg-red-500 text-background hover:bg-red-500/90 disabled:opacity-40 transition-all"
                  >
                    {closing ? 'Closing...' : 'Confirm Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                No active season. Start a new one to resume play — every carried-over player returns to 1000 PTR
                with a clean slate.
              </div>
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Year"
                value={seasonName}
                onChange={e => setSeasonName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-green/50 placeholder:text-muted-foreground/50"
              />
              <input
                type="text"
                placeholder="Location (e.g. Cartagena, Spain)"
                value={seasonLocation}
                onChange={e => setSeasonLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neon-green/50 placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Roster — {carryOverIds.size + newPlayerDrafts.length} selected
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allPlayers.map(p => {
                  const checked = carryOverIds.has(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleCarryOver(p.id)}
                      className={`flex items-center gap-2 h-12 px-2.5 rounded-xl border transition-all ${
                        checked ? 'border-neon-green/50 bg-neon-green/10' : 'border-white/10 bg-white/5 opacity-50'
                      }`}
                    >
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-background shrink-0"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {getInitials(p.name)}
                      </div>
                      <span className="text-xs font-semibold truncate flex-1 text-left">{p.name.split(' ')[0]}</span>
                      {checked && <CheckCircle2 className="h-3.5 w-3.5 text-neon-green shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {newPlayerDrafts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New players</div>
                {newPlayerDrafts.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold flex-1">{d.name}{d.nickname ? ` · "${d.nickname}"` : ''}</span>
                    <button onClick={() => removeDraftPlayer(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New player name"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-neon-green/50 placeholder:text-muted-foreground/50"
              />
              <input
                type="text"
                placeholder="Nickname"
                value={draftNickname}
                onChange={e => setDraftNickname(e.target.value)}
                className="w-24 shrink-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-neon-green/50 placeholder:text-muted-foreground/50"
              />
              <button
                onClick={addDraftPlayer}
                disabled={!draftName.trim()}
                className="shrink-0 h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {startError && <p className="text-xs text-red-400 text-center">{startError}</p>}

            <button
              onClick={handleStartSeason}
              disabled={startingSeason || !seasonName.trim() || !seasonLocation.trim() || (carryOverIds.size === 0 && newPlayerDrafts.length === 0)}
              className="w-full py-3 rounded-xl font-bold text-sm bg-neon-green text-background hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {startingSeason ? 'Starting...' : 'Start Season'}
            </button>
          </div>
        )}

        {closedSeasons.length > 0 && (
          <div className="space-y-2">
            {reopenError && <p className="text-xs text-red-400 text-center">{reopenError}</p>}
            {closedSeasons.map(s => (
              <div key={s.id} className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{s.name} - {s.location}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Closed {s.closedAt ? formatDistanceToNow(new Date(s.closedAt), { addSuffix: true }) : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleReopen(s.id)}
                  disabled={!!activeSeason || reopeningId === s.id}
                  title={activeSeason ? 'Close the current active season first' : 'Reopen this season'}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {reopeningId === s.id ? 'Reopening...' : 'Reopen'}
                </button>
                <button
                  onClick={() => { setConfirmDeleteSeason(confirmDeleteSeason === s.id ? null : s.id); setDeleteConfirmText('') }}
                  title="Delete this season"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {confirmDeleteSeason === s.id && (
                <div className="space-y-2 rounded-lg border border-red-400/20 p-3">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    Permanently deletes {s.name} - {s.location}: every match, event and PTR record in it.
                    Players stay. This can&apos;t be undone — type <span className="font-bold text-foreground">{s.name}</span> to confirm.
                  </div>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={s.name}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400/50 placeholder:text-muted-foreground/30"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setConfirmDeleteSeason(null); setDeleteConfirmText('') }}
                      className="py-2 rounded-xl font-bold text-xs bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteSeason(s.id)}
                      disabled={deleteConfirmText.trim() !== s.name || deletingSeasonId === s.id}
                      className="py-2 rounded-xl font-bold text-xs bg-red-500 text-background hover:bg-red-500/90 disabled:opacity-40 transition-all"
                    >
                      {deletingSeasonId === s.id ? 'Deleting...' : 'Delete Season'}
                    </button>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match list */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match History</h2>

        {deleteError && <p className="text-sm text-red-400 text-center">{deleteError}</p>}

        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matches recorded.</p>
        )}

        {matches.map(match => {
          const teamA = [match.teamAPlayer1, match.teamAPlayer2]
          const teamB = [match.teamBPlayer1, match.teamBPlayer2]
          const incomplete = match.status === 'incomplete'

          return (
            <div key={match.id} className="glass rounded-xl p-3 flex items-center gap-3">
              {/* Teams + score */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    {teamA.map(p => (
                      <div
                        key={p.id}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {getInitials(p.name)}
                      </div>
                    ))}
                  </div>
                  <span className="font-mono text-xs font-bold">{getFullScore(match.sets)}</span>
                  <div className="flex items-center gap-1">
                    {teamB.map(p => (
                      <div
                        key={p.id}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-background"
                        style={{ backgroundColor: p.avatarColor }}
                      >
                        {getInitials(p.name)}
                      </div>
                    ))}
                  </div>
                  {incomplete && (
                    <span className="text-[9px] bg-yellow-400/15 text-yellow-400 rounded px-1 py-0.5 font-medium">INC</span>
                  )}
                  {!match.isRanked && (
                    <span className="text-[9px] bg-white/10 text-muted-foreground rounded px-1 py-0.5 font-medium">UNRANKED</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(match.playedAt), { addSuffix: true })}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(match.id)}
                disabled={deletingId === match.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete match"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Americano events */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Americano Events</h2>

        {eventDeleteError && <p className="text-sm text-red-400 text-center">{eventDeleteError}</p>}

        {americanoEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No events recorded.</p>
        )}

        {americanoEvents.map(event => {
          const leader = event.leaderboard[0]
          const leaderPlayer = leader ? byId.get(leader.playerId) : undefined
          const rosterNames = event.playerIds.map(id => byId.get(id)?.name.split(' ')[0] ?? '?').join(', ')

          return (
            <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold">{event.playerIds.length} players</span>
                  <span
                    className={`text-[9px] rounded px-1 py-0.5 font-medium ${
                      event.status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'
                    }`}
                  >
                    {event.status === 'complete' ? 'COMPLETE' : `${event.matchesComplete}/${event.matchesTotal}`}
                  </span>
                  {!event.isRanked && (
                    <span className="text-[9px] rounded px-1 py-0.5 font-medium bg-white/10 text-muted-foreground">UNRANKED</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{rosterNames}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {leaderPlayer ? `${leaderPlayer.name.split(' ')[0]} leads with ${leader!.points} pts · ` : ''}
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </div>
              </div>

              <button
                onClick={() => handleDeleteEvent(event.id)}
                disabled={deletingEventId === event.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Round Robin events */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Round Robin Events</h2>

        {rrDeleteError && <p className="text-sm text-red-400 text-center">{rrDeleteError}</p>}

        {roundRobinEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No events recorded.</p>
        )}

        {roundRobinEvents.map(event => {
          const leader = event.leaderboard[0]
          const leaderNames = leader
            ? `${byId.get(leader.playerIds[0])?.name.split(' ')[0] ?? '?'} & ${byId.get(leader.playerIds[1])?.name.split(' ')[0] ?? '?'}`
            : null
          const rosterNames = event.teams
            .map(team => team.map(id => byId.get(id)?.name.split(' ')[0] ?? '?').join('/'))
            .join(', ')

          return (
            <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold">{event.teams.length} teams</span>
                  <span
                    className={`text-[9px] rounded px-1 py-0.5 font-medium ${
                      event.status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'
                    }`}
                  >
                    {event.status === 'complete' ? 'COMPLETE' : `${event.matchesComplete}/${event.matchesTotal}`}
                  </span>
                  {!event.isRanked && (
                    <span className="text-[9px] rounded px-1 py-0.5 font-medium bg-white/10 text-muted-foreground">UNRANKED</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{rosterNames}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {leaderNames ? `${leaderNames} leads with ${leader!.points} pts · ` : ''}
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </div>
              </div>

              <button
                onClick={() => handleDeleteRR(event.id)}
                disabled={deletingRRId === event.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* One Point events */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">One Point Events</h2>

        {opDeleteError && <p className="text-sm text-red-400 text-center">{opDeleteError}</p>}

        {onePointEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No events recorded.</p>
        )}

        {onePointEvents.map(event => {
          const champion = event.championId ? byId.get(event.championId) : undefined
          const rosterNames = event.playerIds.map(id => byId.get(id)?.name.split(' ')[0] ?? '?').join(', ')

          return (
            <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold">8 players</span>
                  <span
                    className={`text-[9px] rounded px-1 py-0.5 font-medium ${
                      event.status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'
                    }`}
                  >
                    {event.status === 'complete' ? 'COMPLETE' : `${event.matchesComplete}/${event.matchesTotal}`}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{rosterNames}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {champion ? `${champion.name.split(' ')[0]} won · ` : ''}
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </div>
              </div>

              <button
                onClick={() => handleDeleteOP(event.id)}
                disabled={deletingOPId === event.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Snake and Ladders events */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Snake and Ladders Events</h2>

        {slDeleteError && <p className="text-sm text-red-400 text-center">{slDeleteError}</p>}

        {snakeLaddersEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No events recorded.</p>
        )}

        {snakeLaddersEvents.map(event => {
          const firstPlace = event.firstPlaceIds?.map(id => byId.get(id)?.name.split(' ')[0] ?? '?').join(' & ')
          const rosterNames = event.playerIds.map(id => byId.get(id)?.name.split(' ')[0] ?? '?').join(', ')

          return (
            <div key={event.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold">8 players</span>
                  <span
                    className={`text-[9px] rounded px-1 py-0.5 font-medium ${
                      event.status === 'complete' ? 'bg-neon-green/15 text-neon-green' : 'bg-yellow-400/15 text-yellow-400'
                    }`}
                  >
                    {event.status === 'complete' ? 'COMPLETE' : `Round ${event.currentRound}/${event.totalRounds}`}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{rosterNames}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {firstPlace ? `${firstPlace} won · ` : ''}
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </div>
              </div>

              <button
                onClick={() => handleDeleteSL(event.id)}
                disabled={deletingSLId === event.id}
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                title="Delete event"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
