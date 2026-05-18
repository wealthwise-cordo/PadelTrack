import { NextResponse } from 'next/server'
import { getPlayers } from '@/lib/store'

export async function GET() {
  return NextResponse.json(await getPlayers())
}
