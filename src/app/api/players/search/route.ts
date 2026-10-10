import { NextRequest, NextResponse } from 'next/server'
import { searchPlayers } from '@/lib/store'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const q = req.nextUrl.searchParams.get('q') ?? ''
  return NextResponse.json(await searchPlayers(q))
}
