import { NextResponse } from 'next/server'
import { getSyncFingerprint } from '@/lib/store'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Polled by every open page (see AutoSync). getSession also settles any
// matches past their 48-hour confirmation window, so this doubles as the
// heartbeat that keeps auto-confirm moving.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  return NextResponse.json({ v: await getSyncFingerprint() })
}
