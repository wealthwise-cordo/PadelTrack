import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      include: {
        ptrHistory: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
      orderBy: { ptr: 'desc' },
    })

    const ranked = players.map((p, i) => {
      const history = p.ptrHistory
      const lastDelta = history.length > 0 ? history[history.length - 1].delta : 0
      return {
        ...p,
        rank: i + 1,
        ptrDelta: lastDelta,
        ptrHistory: history.map(h => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
        })),
      }
    })

    return NextResponse.json(ranked)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
}
