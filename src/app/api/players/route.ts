import { NextResponse } from 'next/server'
import { getPlayers } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getPlayers())
}
