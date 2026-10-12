import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/analytics'

// Browser errors from the error boundaries (src/app/error.tsx,
// global-error.tsx). Open to signed-out visitors too, so sizes are capped in
// logError.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.message !== 'string') return NextResponse.json({ ok: false }, { status: 400 })
  const session = await auth()
  await logError({
    source: 'client',
    message: body.digest ? `${body.message} (digest ${String(body.digest).slice(0, 40)})` : body.message,
    stack: typeof body.stack === 'string' ? body.stack : undefined,
    path: typeof body.path === 'string' ? body.path : undefined,
    userId: session?.user?.id,
  })
  return NextResponse.json({ ok: true })
}
