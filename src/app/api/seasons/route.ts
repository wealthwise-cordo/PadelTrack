import { NextRequest, NextResponse } from 'next/server'
import { listSeasons, startNewSeason } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await listSeasons())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, location, carryOverPlayerIds, newPlayers } = body

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Season year is required' }, { status: 400 })
  }
  if (typeof location !== 'string' || !location.trim()) {
    return NextResponse.json({ error: 'Season location is required' }, { status: 400 })
  }
  if (!Array.isArray(carryOverPlayerIds) || carryOverPlayerIds.some((id: unknown) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Invalid carry-over players' }, { status: 400 })
  }
  const newPlayerDefs = Array.isArray(newPlayers) ? newPlayers : []
  for (const np of newPlayerDefs) {
    if (typeof np?.name !== 'string' || !np.name.trim()) {
      return NextResponse.json({ error: 'Each new player needs a name' }, { status: 400 })
    }
  }

  const result = await startNewSeason({
    name,
    location,
    carryOverPlayerIds,
    newPlayers: newPlayerDefs.map((np: { name: string; nickname?: string; avatarColor?: string }) => ({
      name: np.name.trim(),
      nickname: np.nickname?.trim() || undefined,
      avatarColor: np.avatarColor,
    })),
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
