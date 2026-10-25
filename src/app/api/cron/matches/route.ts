import { NextRequest, NextResponse } from 'next/server'
import { runDueNotifications } from '@/lib/scheduled-matches'
import { logError } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

// Called every 10 minutes by an external scheduler (cron-job.org) with the
// header "Authorization: Bearer <CRON_SECRET>". Sends scheduled-match
// reminders (25h before), score prompts (2h after) and dispute nudges, and
// settles expired pending matches.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await runDueNotifications()) })
  } catch (error) {
    await logError({ source: 'server', error, path: '/api/cron/matches' })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
