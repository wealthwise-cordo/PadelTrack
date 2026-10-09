import { NextRequest, NextResponse } from 'next/server'
import { closeSeason } from '@/lib/store'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await closeSeason(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
