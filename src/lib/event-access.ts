import { getEventPlayers } from './store'
import type { PlayerWithStats } from '@/types'

// Events belong to the user who created them. The organiser and any
// registered player taking part can enter scores; only the organiser can
// delete. Events never touch ratings.
export type Actor = { userId: string; playerId: string }

export function canManageEvent(
  event: { ownerId: string; playerIds?: string[]; teamPlayerIds?: string[] },
  actor: Actor
): boolean {
  if (event.ownerId === actor.userId) return true
  const ids = event.playerIds ?? event.teamPlayerIds ?? []
  return ids.includes(actor.playerId)
}

// Events the actor organised or plays in.
export function eventsVisibleTo(actor: Actor, field: 'playerIds' | 'teamPlayerIds' = 'playerIds') {
  return { OR: [{ ownerId: actor.userId }, { [field]: { has: actor.playerId } }] }
}

// Checks an event roster: right size, no duplicates, every id a real player.
// Returns the players ordered by rating (used to seed bracket/ladder formats).
export async function validateRoster(
  playerIds: unknown,
  allowedSizes: number[],
  formatName: string
): Promise<{ players: PlayerWithStats[] } | { error: string }> {
  if (!Array.isArray(playerIds) || playerIds.some(id => typeof id !== 'string')) {
    return { error: 'Invalid players' }
  }
  if (!allowedSizes.includes(playerIds.length)) {
    const sizes = allowedSizes.length === 1 ? `exactly ${allowedSizes[0]}` : allowedSizes.join(', ').replace(/, (\d+)$/, ' or $1')
    return { error: `${formatName} needs ${sizes} players` }
  }
  if (new Set(playerIds).size !== playerIds.length) return { error: 'A player can only be added once' }
  const players = await getEventPlayers(playerIds as string[])
  if (players.length !== playerIds.length) return { error: 'One or more players were not found' }
  return { players: [...players].sort((a, b) => b.ptr - a.ptr) }
}
