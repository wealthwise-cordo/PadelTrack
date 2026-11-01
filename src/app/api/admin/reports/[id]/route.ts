import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getRole } from '@/lib/roles'
import { resolveReport } from '@/lib/safety'

// The super user marking a report resolved. Body: { resolution? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if ((await getRole(session.userId)) !== 'superuser') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const result = await resolveReport(session.userId, params.id, b.resolution)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
