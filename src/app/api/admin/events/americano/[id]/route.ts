import { NextRequest, NextResponse } from 'next/server'
import { deleteAmericanoEvent } from '@/lib/americano-store'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await deleteAmericanoEvent(params.id, { allowComplete: true })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
