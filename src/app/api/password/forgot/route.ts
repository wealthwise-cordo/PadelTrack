import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/store'
import { appUrl } from '@/lib/email'

// Always answers the same way, whether or not the email has an account.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter your email address' }, { status: 400 })
  }
  try {
    await requestPasswordReset(email, appUrl(req.nextUrl.origin))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Could not send the email — try again in a minute' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
