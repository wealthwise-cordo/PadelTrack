import { NextRequest, NextResponse } from 'next/server'
import { deleteSeason } from '@/lib/store'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await deleteSeason(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
