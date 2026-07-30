import { NextRequest, NextResponse } from 'next/server'
import { deleteRoundRobinEvent } from '@/lib/round-robin-store'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await deleteRoundRobinEvent(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
