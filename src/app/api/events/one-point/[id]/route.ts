import { NextRequest, NextResponse } from 'next/server'
import { deleteOnePointEvent } from '@/lib/one-point-store'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await deleteOnePointEvent(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
