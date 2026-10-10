import { NextRequest, NextResponse } from 'next/server'
import { confirmMatch } from '@/lib/store'
import { getSession } from '@/lib/session'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const result = await confirmMatch(params.id, session.userId)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
