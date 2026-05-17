import MatchEntryForm from '@/components/matches/MatchEntryForm'
import { prisma } from '@/lib/prisma'

export const revalidate = 0

async function getPlayers() {
  const players = await prisma.player.findMany({
    orderBy: { ptr: 'desc' },
  })
  return players.map(p => ({
    ...p,
    ptrHistory: [],
    rank: 0,
    ptrDelta: 0,
  }))
}

export default async function NewMatchPage() {
  const players = await getPlayers()

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Record Match</h1>
      <MatchEntryForm players={players as any} />
    </div>
  )
}
