import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateRoster } from '@/lib/event-access'
import { createRoundRobinEvent } from '@/lib/round-robin-store'
import { ROUND_ROBIN_MIN_TEAMS, ROUND_ROBIN_MAX_TEAMS, ROUND_ROBIN_MAX_COURTS, LEAGUE_SCORING, LEAGUE_GAMES_TARGET, oneOffTargetValid, type LeagueScoring, type OneOffScoring } from '@/lib/round-robin'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { teams, target, courts = 1, league = false, scoring = 'games' } = await req.json()

  if (!Array.isArray(teams) || teams.length < ROUND_ROBIN_MIN_TEAMS) {
    return NextResponse.json({ error: `Round Robin needs at least ${ROUND_ROBIN_MIN_TEAMS} teams` }, { status: 400 })
  }
  if (teams.length > ROUND_ROBIN_MAX_TEAMS) {
    return NextResponse.json({ error: `Round Robin can have up to ${ROUND_ROBIN_MAX_TEAMS} teams` }, { status: 400 })
  }
  for (const team of teams) {
    if (!Array.isArray(team) || team.length !== 2) {
      return NextResponse.json({ error: 'Each team must have exactly 2 players' }, { status: 400 })
    }
  }
  const roster = await validateRoster(teams.flat(), [teams.length * 2], 'Round Robin')
  if ('error' in roster) return NextResponse.json(roster, { status: 400 })
  // Leagues follow ranked-match rules, so everyone must have a PadelTrack account.
  if (league === true) {
    const guests = roster.players.filter(p => p.isGuest)
    if (guests.length) {
      return NextResponse.json({ error: `Leagues are for PadelTrack users only — remove ${guests.map(g => g.name).join(', ')}` }, { status: 400 })
    }
    if (!(scoring in LEAGUE_SCORING)) return NextResponse.json({ error: 'Pick how league matches are scored' }, { status: 400 })
  } else {
    if (scoring !== 'games' && scoring !== 'points') return NextResponse.json({ error: 'Pick games or points' }, { status: 400 })
    if (!oneOffTargetValid(scoring, target)) {
      return NextResponse.json({ error: scoring === 'points' ? 'Points must be an odd number from 3 to 33' : 'Games target must be 4, 6, or 8' }, { status: 400 })
    }
  }

  if (typeof league !== 'boolean') return NextResponse.json({ error: 'Invalid league setting' }, { status: 400 })
  if (!Number.isInteger(courts) || courts < 1 || courts > ROUND_ROBIN_MAX_COURTS) {
    return NextResponse.json({ error: `Courts must be 1 to ${ROUND_ROBIN_MAX_COURTS}` }, { status: 400 })
  }

  const id = await createRoundRobinEvent(
    teams as [string, string][],
    league ? LEAGUE_GAMES_TARGET : target,
    session.userId,
    courts,
    league,
    league ? (scoring as LeagueScoring) : (scoring as OneOffScoring)
  )
  return NextResponse.json({ id })
}
