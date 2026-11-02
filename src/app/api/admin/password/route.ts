import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { setAdminPassword } from '@/lib/admin-auth'

// Setting or changing the admin password. Body: { accountPassword, newPassword }.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const result = await setAdminPassword(session.userId, b.accountPassword, b.newPassword)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
